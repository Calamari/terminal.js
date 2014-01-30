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

    this.history = new History({
      sessionKey: (config.sessionKey || 'Terminal') + '.history'
    });
    this.tempInput = null;

    this.createPrompt(config.prompt || '$');
    this.initCaret();
    this.registerListeners();
    if (config.onStart) {
      var self = this;
      config.onStart(function() {
        self.prompt();
      });
    } else {
      this.prompt();
    }
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
    if (Terminal.Commands[cmd]) {
      Terminal.Commands[cmd].run.apply(this, args);
    } else if (Terminal.Aliases[cmd]) {
      this.runCommand(Terminal.Aliases[cmd], args);
    }
  };

  Terminal.checkRegexCommands = function checkRegexCommands(cmd) {
    var result = null;
    $.each(Terminal.RegexCommands, function(i, cmdObj) {
      console.log(arguments);
      if (cmdObj.test(cmd)) {
        result = cmdObj;
        return true;
      }
    });
    return result;
  };

  Terminal.prototype.evalInput = function evalInput(input) {
    if (input.trim() === '') {
      return this.prompt();
    }
    this.promptWaiting = false;

    var split = input.split(' '),
        cmd   = split[0],
        args  = input.substr(cmd.length + 1),
        testedCmd = Terminal.checkRegexCommands(cmd);

    this.history.add(input);

    if (testedCmd) {
      testedCmd.run.apply(this, [args, function() {
        this.prompt();
      }.bind(this)]);
    } else if (Terminal.Commands[cmd] || Terminal.Aliases[cmd]) {
      this.runCommand(cmd, [args, function() {
        this.prompt();
      }.bind(this)]);
    } else {
      this.append(cmd + ': Command not found');
      this.nextLine();
      this.prompt();
    }
  };

  Terminal.prototype.listenInput = function listenInput(event) {
    var input = this.hiddenInput.val(),
        self = this,
        caretPos;
    // console.log("key", event.which, event);

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

  Terminal.prototype.nextLine = function nextLine() {
    this.element.append('<p></p>');
    this.element.find('p:last').append(this.caret);
    // this neat trick scrolls down
    win.scrollTo(0, $(doc).height());
  };

  Terminal.prototype.currentLine = function currentLine() {
    return this.element.find('p:last');
  };

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
      if ($.isFunction(desc)) {
        if (typeof desc === 'string') {
          Terminal.addAlias(name, desc);
        } else {
          Terminal.addCommand(name, {
            description: '',
            run: desc
          });
        }
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
