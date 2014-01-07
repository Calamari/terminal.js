(function(win, doc, Terminal) {
  'use strict';

  Terminal.addCommand('commands', 'Just prints a list of all available commands. Use "help" for more info.', function(args, done) {
    this.appendLine('All available commands: ' + Object.keys(Terminal.Commands).join(', '));
    done();
  });

  Terminal.addCommand('help', 'Shows all available commands.', function(args, done) {
    var tab      = new Tabular({
          newLine: '<br>',
          padding: '&nbsp;',
          gutter:  '&nbsp;&nbsp;'
        }),
        self     = this,
        commands = [],
        cmdObj;

    $.map(Object.keys(Terminal.Commands), function(cmd) {
      cmdObj = Terminal.Commands[cmd]
      commands.push([cmd, !cmdObj.description && cmdObj.aliasFor ? 'Alias for ' + cmdObj.aliasFor : cmdObj.description]);
    });

    this.appendLine('All available commands: ');
    this.appendLine(tab.render(commands));
    done();
  });

  Terminal.addCommand('reload', 'Reloads the browser.', function(args, done) {
    win.location.href += '';
    done();
  });

  Terminal.addCommand('version', 'Displays the version number of this terminal.', function(args, done) {
    this.appendLine(VERSION);
    done();
  });

  Terminal.addCommand('sleep', 'Sleeps for given amount of seconds. Good night.', function(args, done) {
    var seconds = parseFloat(args);
    if (isNaN(seconds)) {
      this.appendLine('Usage: sleep SECONDS');
      done();
    } else {
      setTimeout(done, seconds * 1000);
    }
  });

  Terminal.addCommand('google', 'Opens google with given search', function(args, done) {
    if (!args) {
      this.appendLine('Usage: google your search term');
    } else {
      window.open('https://www.google.de/#q=' + encodeURIComponent(args));
    }
    done();
  });

  Terminal.addCommand('yql', 'Ask YQL something', function(args, done) {
    if (!args) {
      this.appendLine('Usage: yql SELECT * FROM geo.places WHERE text="Hamburg, Germany"');
      done();
    } else {
      var request = Terminal.utils.createCORSRequest('get', 'http://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(args) + '&diagnostics=true&format=json'),
          terminal = this;
      if (request) {
        terminal.appendLine('Sending YQL query: ' + args);
        request.onload = function(){
          var obj   = JSON.parse(request.responseText),
              // this formats the JSON nicely:
              lines = JSON.stringify(obj, null, 4).split('\n');
          for(var i = 0, l=lines.length; i<l; ++i) {
            terminal.appendLine('<pre>' + lines[i] + '</pre>');
          }
          done();
        };
        request.send();
      } else {
        terminal.appendLine('Can\'t send CORS request to YQL. Your browser is to old. Try a newer one.');
      }
    }
  });

  Terminal.addCommand('load', 'Loads a js or css file', function(args, done) {
    if (!args) {
      this.appendLine('Usage: load FILE_URL');
      done();
    } else {
      var filename  = args,
          isCSS     = /\.css$/.test(filename),
          parent    = doc.getElementsByTagName('body')[0],
          script    = doc.createElement(isCSS ? 'link' : 'script'),

          terminal  = this,
          isRunning = true,

          scriptLoad = function scriptLoad(event) {
            if (isRunning) {
              isRunning = false;
              terminal.appendLine('Done.');
              done();
            }
          },
          scriptError = function scriptError() {
            if (isRunning) {
              isRunning = false;
              terminal.appendLine('Failed. Sorry');
              done();
            }
          };

      if (script.attachEvent &&
        !(script.attachEvent.toString && script.attachEvent.toString().indexOf('[native code') < 0)) {

        // TODO: Test this in IE and Opera
        script.attachEvent('onreadystatechange', scriptLoad);
      } else {
        script.addEventListener('load', scriptLoad, false);
        script.addEventListener('error', scriptError, false);
      }

      terminal.appendLine('Loading script: ' + filename);
      if (isCSS) {
        script.type = 'text/css';
        script.rel  = 'stylesheet';
        script.href = filename;
      } else {
        script.src = filename;
      }
      parent.appendChild(script);

      // If script is not loaded within 2 seconds, we deem it failed
      setTimeout(scriptError, 2000);

    }
  });

}(window, document, Terminal));
