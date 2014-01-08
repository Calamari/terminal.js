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

    if (this.CAN_USE_LOCALSTORAGE) {
      try {
        this.storage = JSON.parse(localStorage.getItem('terminalHistory')) || [];
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
      localStorage.setItem('terminalHistory', JSON.stringify(this.storage));
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

    this.history = new History();
    this.tempInput = null;

    this.createPrompt(config.prompt || '$');
    this.initCaret();
    this.registerListeners();
    if (config.onStart) {
      config.onStart.apply(this, function() {
        this.prompt();
      }.bind(this));
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
    if (typeof Terminal.Commands[cmd] === 'string') {
      this.runCommand(Terminal.Commands[cmd], args);
    } else {
      if (Terminal.Commands[cmd].run) {
        Terminal.Commands[cmd].run.apply(this, args);
      } else if (Terminal.Commands[cmd].aliasFor) {
        this.runCommand(Terminal.Commands[cmd].aliasFor, args);
      } else {
        Terminal.Commands[cmd].apply(this, args);
      }
    }
  };

  Terminal.prototype.evalInput = function evalInput(input) {
    if (input.trim() === '') {
      return this.prompt();
    }
    this.promptWaiting = false;

    var split = input.split(' '),
        cmd   = split[0],
        args  = input.substr(cmd.length + 1);

    this.history.add(input);

    if (Terminal.Commands[cmd]) {
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

          this.evalInput(input.trim());
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
      this.hiddenInput.focus();
      $('body').on('click', function() {
        this.hiddenInput.focus();
      }.bind(this));
    }
    this.enable();
  };

  Terminal.prototype.enable = function enable() {
    if (!this.isListening) {
      this.hiddenInput.on('keyup', this.listenInput.bind(this));
      this.isListening = true;
      this.element.removeClass('disabled');
    }
  };

  Terminal.prototype.disable = function disable() {
    this.hiddenInput.off('keyup');
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

  Terminal.prototype.nextLine = function nextLine(text) {
    this.element.append('<p></p>');
    this.element.find('p:last').append(this.caret);
    // this neat trick scrolls down
    win.scrollTo(0,$(doc).height())
  };

  Terminal.prototype.currentLine = function currentLine() {
    return this.element.find('p:last');
  };

  Terminal.addCommand = function addCommand(name, desc, runFunc) {
    if (arguments.length === 2) {
      runFunc = desc;
      desc = '';
    }

    var command = {
      description: desc
    };

    if (typeof runFunc === 'string') {
      command.aliasFor = runFunc;
    } else {
      command.run = runFunc;
    }
    Terminal.Commands[name] = command;
  };

  Terminal.Commands = {};

  win.Terminal = Terminal;
}(window, document));
