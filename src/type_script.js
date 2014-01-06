/*!
 * Script that immitates typing into the terminal
 * It has varying typing speeds, and can be scripted with
 * different commands
 * @author Georg Tavonius <g.tavonius@gmail.com>
 */
(function(win, doc) {
  'use strict';

  /**
   * This represents a command for the typing script
   * Each type does something diffently, the most basic type is "PRINT"
   */
  function Command(type, args) {
    this.type = type;
    this.args = args;
  }

  var Commands = {
    'SLEEP': function runSleep(skript, terminal, done) {
      if (skript.instant) { return done(); }

      var milliseconds = parseInt(this.args, 10);

      setTimeout(function() {
        done();
      }, skript.faster ? milliseconds/2 : milliseconds);
    },
    'LINK': function runLink(skript, terminal, done) {
      var inputElement = $('<a target="_blank" href="' + this.args[0] + '"></a>'),
          linkText     = this.args[1],
          len          = linkText.length;

      terminal.append(inputElement);
      function writeLink(i) {
        skript.typeWait(function() {
          if (i < len) {
            inputElement[0].innerHTML += linkText[i];
            writeLink(i+1);
          } else {
            done();
          }
        });
      }
      writeLink(0);
    },
    'PRINT': function runPrint(skript, terminal, done) {
      skript.typeWrite(this.args, done);
    },
    'HTML': function runPrint(skript, terminal, done) {
      terminal.append(this.args);
      done();
    },
    'LINEBREAK': function runLinebreak(skript, terminal, done) {
      terminal.nextLine();
      done();
    }
  };

  /**
   * This runs the command.
   * Beware: Commands can be asynchrounous, so it will use a done callback
   */
  Command.prototype.run = function runCommand(skript, terminal, done) {
    if (Commands[this.type]) {
      Commands[this.type].call(this, skript, terminal, done);
    } else {
      done();
    }
  };

  /**
   * Factory method that creates a Command out of a simple String
   * The syntax is #{TYPE:ARG1;ARG2;ETC}
   */
  Command.create = function runCommand(raw) {
    var parts = raw.match(/^#{(.*?)(:(.*?))?}$/);
    if (parts) {
      return new Command(parts[1], parts[3] ? parts[3].split(';') : null);
    } else {
      return '';
    }
  };

  /**
   * Represents a Line in the script
   * A script can have a lot of those
   */
  function Line(text) {
    var raw = text.trim().replace(/<a href="(.*?)">(.*?)<\/a>/g, '#{LINK:$1;$2}').replace(/<.*?>/g, '');
    this.commands = [];

    var commands = raw.match(/#{(.*?)}/g) || [],
        p = 0,
        len;

    for (var i =0; i<commands.length; ++i) {
      len = commands[i].length;

      this.commands.push(new Command('PRINT', raw.substr(p, raw.indexOf(commands[i]) - p)));
      this.commands.push(Command.create(raw.substr(raw.indexOf(commands[i]), len)));
      p += raw.indexOf(commands[i]) + len;
    }

    if (raw.substr(p)) {
      this.commands.push(new Command('PRINT', raw.substr(p)));
    } else {
      this.commands.push(new Command('SLEEP', 400));
    }
    this.commands.push(new Command('LINEBREAK', '<br>'));
  }

  /**
   * This is the TypeScript class
   * It uses the given script (given as simple text string) and creates
   * a runable representation out of it
   * Scripts can be fastened up through hitting space or enter once
   * Hitting it twice will remove all delays (SLEEPS and typing delays)
   */
  var TypeScript = function TypeScript(text) {
    this.typingSpeed = 60;
    this.typingVariance = 40;
    this.lines = this.processText(text);
  };

  TypeScript.prototype.processText = function processText(text) {
    return $.map(text.trim().split('\n'), function(line) {
      return new Line(line);
    });
  };

  TypeScript.prototype.startListening = function startListening() {
    var self = this;
    this._listener = $(doc).on('keydown', function(event) {
      switch(event.which) {
        case 32: // Space
        case 13: // Enter
          if (!self.faster) {
            // fasten up
            self.faster = true;
            self.typingSpeed /= 2;
            self.typingVariance /= 2;
          } else {
            // instant
            self.instant = true;
          }
      }
    });
  };

  TypeScript.prototype.stopListening = function stopListening() {
    this._listener && this._listener.off();
  };

  TypeScript.prototype.run = function runTypeScript(terminal, done) {
    this.terminal = terminal;
    var cursor = [0, 0],
        self = this,
        x, y;

    function skriptLoop() {
        y = cursor[0];
        x = cursor[1];

        if (self.lines[y] && self.lines[y].commands[x]) {
          self.lines[y].commands[x].run(self, terminal, function checkRunning() {

            ++cursor[1];
            if (cursor[1] >= self.lines[y].commands.length) {
              ++cursor[0];
              cursor[1] = 0;
            }

            setTimeout(function() {
              skriptLoop();
            }, self.typingSpeed);
          });
        } else {
          self.stopListening();
          done && done();
        }
    }
    self.startListening();
    skriptLoop();
  };

  /**
   * Calls the callback after a short delay mimicing the typing speed
   */
  TypeScript.prototype.typeWait = function typeWait(cb) {
    if (this.instant) {
      cb();
    } else {
      setTimeout(cb, this.typingSpeed + Math.random()*2*this.typingVariance-this.typingVariance);
    }
  };

  /**
   * Writes given text and using a delay mimicing the typing speed for each character
   */
  TypeScript.prototype.typeWrite = function typeWrite(text, cb) {
    var self = this;
    function write(i) {
      if (i < text.length) {
        self.terminal.append(text[i]);
        self.typeWait(function() {
          write(i+1);
        });
      } else {
        cb();
      }
    }
    write(0);
  };

  win.TypeScript = TypeScript;
}(window, document));
