(function(win, doc) {
  'use strict';

  var VERSION = 'v0.2';

  /*
   * From http://stackoverflow.com/questions/2897155/get-cursor-position-within-a-text-input-field
   * Returns the caret (cursor) position of the specified text field.
   */
  function getCaretPosition(inputField) {
    var iCaretPos = 0;

    // IE Support
    if (document.selection) {

      // Set focus on the element
      inputField.focus();

      // To get cursor position, get empty selection range
      var oSel = document.selection.createRange();

      // Move selection start to 0 position
      oSel.moveStart('character', -inputField.value.length);

      // The caret position is selection length
      iCaretPos = oSel.text.length;
    } else {
      iCaretPos = inputField.selectionStart;
    }

    return iCaretPos;
  }


  var History = function(config) {
    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      this.CAN_USE_LOCALSTORAGE = true;
    } catch(ex) {
      this.CAN_USE_LOCALSTORAGE = false;
    }

    config = config || {};
    this.limit = config.limit || 1000;
    this.sessionKey = config.sessionKey || 'terminalHistory';

    if (this.CAN_USE_LOCALSTORAGE) {
      try {
        this.storage = JSON.parse(localStorage.getItem(this.sessionKey)) || [];
      } catch(ex) {
        this.storage = [];
      }
    } else {
      this.storage = [];
    }
    this.toEnd();
  };

  History.prototype.add = function add(cmd) {
    this.storage.push(cmd);
    var toMuch = this.storage.length - this.limit;
    if (toMuch > 0) {
      this.storage = this.storage.splice(toMuch);
    }
    this.saveHistory();
  };

  History.prototype.saveHistory = function saveHistory(cmd) {
    if (this.CAN_USE_LOCALSTORAGE) {
      localStorage.setItem(this.sessionKey, JSON.stringify(this.storage));
    }
  };

  History.prototype.prev = function prev(cmd) {
    this.pointer = Math.max(0, this.pointer - 1);
    return this.get();
  };

  History.prototype.next = function next(cmd) {
    if (this.pointer + 1 > this.storage.length) {
      throw new Error('Already at end');
    }
    this.pointer = Math.min(this.pointer + 1, this.storage.length);
    return this.get();
  };

  History.prototype.toEnd = function toEnd(cmd) {
    this.pointer = this.storage.length;
    return this.get();
  };

  History.prototype.toBegin = function toBegin(cmd) {
    this.pointer = 0;
    return this.get();
  };

  History.prototype.get = function get(pos) {
    return this.storage[pos || this.pointer] || null;
  };


  var Terminal = function Terminal(element, config) {
    config = config || {};
    this.element = $(element);
    this.element.css('overflow-y', 'scroll');

    this.history = new History({
      sessionKey: (config.sessionKey || 'Terminal') + '.history'
    });
    this.tempInput = null;

    this.createPrompt(config.prompt || '$');
    this.initCaret();
    this.registerListeners();
    if (config.onStart) {
      var self = this;
      config.onStart.call(this, function() {
        self.prompt();
      });
    } else {
      this.prompt();
    }
    this.onError = config.onError;
  };

  Terminal.prototype.createPrompt = function createPrompt(text) {
    this.promptElement = $('<span class="prompt">' + text + ' </span>');
    this.inputElementBefore = $('<span class="promptInput"></span>');
    this.inputElementAfter = $('<span class="promptInput"></span>');
  };

  Terminal.prototype.initCaret = function initCaret() {
    this.caret = $('<span class="caret"></span>');
    this.element.html('<p></p>');
    this.element.find('p:last').append(this.caret);

    var self = this;
    this.caretInterval = setInterval(function blinkCaret() {
      self.caret.toggle();
    }, 400);
  };

  Terminal.prototype.runCommand = function runCommand(cmd, args) {
    try {
      if (Terminal.Commands[cmd]) {
        Terminal.Commands[cmd].run.apply(this, args);
        return true;
      } else if (Terminal.Aliases[cmd]) {
        return this.runCommand(Terminal.Aliases[cmd], args);
      }
      return false;
    } catch(ex) {
      if (this.onError) {
        this.onError.call(this, ex);
      } else {
        throw ex;
      }
    }
  };

  Terminal.removeCommand = function removeCommand(cmd) {
    if (typeof cmd === 'string') {
      delete Terminal.Commands[cmd];
    } else {
      Terminal.RegexCommands = $.grep(Terminal.RegexCommands, function(rCmd) {
        return rCmd !== cmd;
      });
    }
  };

  Terminal.checkRegexCommands = function checkRegexCommands(cmd, args) {
    var result = null;
    $.each(Terminal.RegexCommands, function(i, cmdObj) {
      if (cmdObj.test(cmd, args)) {
        result = cmdObj;
        return true;
      }
    });
    return result;
  };

  Terminal.prototype.evalInput = function evalInput(input, hidden) {
    if (input.trim() === '') {
      return this.prompt();
    }
    this.promptWaiting = false;

    var split = input.split(' '),
        cmd   = split[0],
        args  = input.substr(cmd.length + 1),
        testedCmd = Terminal.checkRegexCommands(cmd, args),
        self      = this;

    if (!hidden) {
      this.history.add(input);
    }

    function processCommand() {
      var cmdFound = false;
      if (Terminal.Commands[cmd] || Terminal.Aliases[cmd]) {
        cmdFound = self.runCommand(cmd, [args, function doneCmd() {
          self.prompt();
        }]);
      }
      if (!cmdFound) {
        self.appendLine(cmd + ': Command not found');
        self.prompt();
      }
    }

    if (testedCmd) {
      testedCmd.run.apply(this, [args, function doneRegexCmd() {
        self.prompt();
      }, processCommand]);
    } else {
      processCommand();
    }
  };

  Terminal.prototype.listenInput = function listenInput(event) {
    var input = this.hiddenInput.val(),
        self = this,
        caretPos;

    if (this.promptWaiting) {
      switch (event.which) {
        case 13: // enter
          this.hiddenInput.val('');
          this.tempInput = null;

          this.append(this.promptElement.text() + input);
          this.promptElement.remove();
          this.nextLine();

          setTimeout(function() {
            // Call the commands async after this keydown is worked through
            self.evalInput(input.trim());
          }, 10);
          break;
        case 38: // Arrow UP
          this.hiddenInput.val(this.history.prev());
          caretPos = 1000;
          break;
        case 40: // Arrow DOWN
          try {
            var val = this.history.next();
            if (val === null) {
              this.hiddenInput.val(this.tempInput || '');
            } else {
              this.hiddenInput.val(val);
            }
          } catch(ex) {}
          caretPos = 1000;
          break;
        default:
          this.tempInput = input;
          this.history.toEnd();
      }

      this.checkInputValue(caretPos);
    }

    event.stopPropagation();
  };

  Terminal.prototype.checkInputValue = function checkInputValue(caretPos) {
    var input    = this.hiddenInput.val();
    caretPos = caretPos || getCaretPosition(this.hiddenInput[0]);
    this.inputElementBefore.text(input.substr(0, caretPos));
    this.inputElementAfter.text(input.substr(caretPos));
  };

  Terminal.prototype.registerListeners = function registerListeners() {
    if (!this.hiddenInput) {
      this.hiddenInput = $('<input type="text" style="opacity:0;position: absolute"/>');
      $('body').append(this.hiddenInput);
      this.focus();
      $('body').on('click', function() {
        this.focus();
      }.bind(this));
    }
    this.enable();
  };

  Terminal.prototype.focus = function focus() {
    this.hiddenInput.focus();
  };

  Terminal.prototype.enable = function enable() {
    if (!this.isListening) {
      if (this.valBeforeDisable !== null) {
        this.hiddenInput.val(this.valBeforeDisable);
        delete this.valBeforeDisable;
      }
      this.hiddenInput.on('keydown', this.listenInput.bind(this));
      this.hiddenInput.on('keyup', function() { this.checkInputValue() }.bind(this));
      this.isListening = true;
      this.element.removeClass('disabled');
    }
  };

  Terminal.prototype.disable = function disable() {
    this.hiddenInput.off('keydown');
    this.hiddenInput.off('keyup');
    this.valBeforeDisable = this.hiddenInput.val();
    this.isListening = false;
    this.element.addClass('disabled');
  };


  Terminal.prototype.prompt = function prompt() {
    var self = this;
    this.caret.before(this.promptElement);
    this.caret.before(this.inputElementBefore);
    this.caret.after(this.inputElementAfter);
    this.promptWaiting = true;
    this.checkInputValue();
    this.history.toEnd();
  };

  Terminal.prototype.append = function append(text) {
    this.caret.before(text);
  };

  Terminal.prototype.appendLine = function appendLine(text) {
    this.append(text);
    this.nextLine();
  };

  Terminal.prototype.appendLines = function appendLine(lines) {
    var self = this;
    lines.forEach(function(line) {
      self.append(line);
      self.nextLine();
    });
  };

  Terminal.prototype.nextLine = function nextLine() {
    this.element.append('<p></p>');
    this.element.find('p:last').append(this.caret);
    // this neat trick scrolls down
    this.hiddenInput[0].scrollIntoView(true);
  };

  Terminal.prototype.currentLine = function currentLine() {
    return this.element.find('p:last');
  };

  Terminal.VERSION = VERSION;

  /**
   * Contains all defined aliases for faster access
   */
  Terminal.Aliases = {};

  /**
   * Contains all named commands
   */
  Terminal.Commands = {};

  /**
   * Contains all commands that run when matching a test
   */
  Terminal.RegexCommands = [];

  Terminal.addAlias = function addAlias(name, alias) {
    Terminal.Aliases[alias] = name;
  };

  Terminal.addCommand = function addCommand(name, desc, runFunc) {
    if (arguments.length === 1) { // regex command
      Terminal.RegexCommands.push(name);
    } else if (arguments.length === 2) {
      if (typeof desc === 'string') {
        Terminal.addAlias(desc, name);
      } else if ($.isFunction(desc)) {
        Terminal.addCommand(name, {
          description: '',
          run: desc
        });
      } else { // The real version
        var command = desc;
        Terminal.Commands[name] = command;
        if (command.aliases) {
          command.aliases.forEach(function(alias) {
            Terminal.addAlias(name, alias);
          });
        }
      }
    } else {
      Terminal.addCommand(name, {
        description: desc,
        run: runFunc
      });
    }
  };


  win.Terminal = Terminal;
}(window, document));
