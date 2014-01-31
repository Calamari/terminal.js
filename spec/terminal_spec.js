
/* globals Terminal*/
describe('Terminal', function() {
  var element, clock;

  before(function() {
    $('body').append('<div id="terminal"></div>');
    element = $('#terminal');
  });

  after(function() {
    $('#terminal').remove();
  });

  beforeEach(function() {
    clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    clock.restore();
    $('body input').remove();
  });

  it('can use a onStart callback', function(done) {
    new Terminal('#terminal', {
      onStart: function(next) {
        expect(next).to.be.a('function');
        done();
      }
    });
  });

  describe('if command throws up', function() {
    before(function() {
      Terminal.addCommand('breakingbad', function() {
        throw new Error('bad');
      });
    });

    it('it breaks', function() {
      var terminal = new Terminal('#terminal');
      expect(function() {
        terminal.evalInput('breakingbad');
      }).to.throw();
    });

    it('it does not break, when onError is provided', function() {
      var onErrorCalled = false;
      var terminal = new Terminal('#terminal', {
        onError: function() {
          onErrorCalled = true;
        }
      });
      expect(function() {
        terminal.evalInput('breakingbad');
      }).to.not.throw();
      expect(onErrorCalled).to.equal(true);
    });
  });

  describe('on initialization', function() {
    beforeEach(function(done) {
      new Terminal('#terminal', {
        onStart: function(next) {
          next();
          done();
        }
      });
    });

    it('it adds a line with caret to terminal', function() {
      expect(element.find('p .caret'));
    });

    it('the caret is blinking', function() {
      var caret = element.find('p .caret');
      expect(caret.css('display')).not.to.eql('none');
      clock.tick(400);
      expect(caret.css('display')).to.eql('none');
      clock.tick(400);
      expect(caret.css('display')).not.to.eql('none');
    });

    it('it adds a hidden input field to the body', function() {
      expect($('body').find('input')).to.have.length(1);
    });
  });

  describe('#addCommand', function() {
    var terminal, testCalled;
    before(function() {
      Terminal.addCommand('test', {
        aliases: ['testing', 'testen'],
        run: function(args, done) {
          testCalled = true;
          done();
        }
      });
    });

    beforeEach(function() {
      testCalled = false;
      terminal = new Terminal('#terminal');
    });

    it('added command can be called', function() {
      terminal.evalInput('test');
      expect(testCalled).to.equal(true);
    });

    it('added command can be called via alias', function() {
      terminal.evalInput('testing');
      expect(testCalled).to.equal(true);
    });

    it('test method of regex command gets the command part and rest of input as params', function() {
      var cmdTest;
      var cmd = {
        test: function(cmd, args) {
          console.log(arguments);
          expect(cmd).to.equal('testing');
          expect(args).to.equal('it good');
          cmdTest = true;
          return true;
        },
        run: function(args, done) {
          done();
        }
      };
      Terminal.addCommand(cmd);

      terminal.evalInput('testing it good');
      expect(cmdTest).to.equal(true);

      Terminal.removeCommand(cmd);
    });

    it('added command via regex are called before regular commands and prevent them', function() {
      var cmdTest, cmdRun;
      var cmd = {
        test: function(cmd) {
          cmdTest = true;
          return true;
        },
        run: function(args, done) {
          cmdRun = true;
          done();
        }
      };
      Terminal.addCommand(cmd);

      terminal.evalInput('testing');
      expect(cmdTest).to.equal(true);
      expect(cmdRun).to.equal(true);
      expect(testCalled).to.equal(false);

      Terminal.removeCommand(cmd);
    });

    it('added command via regex can allow regular commands to still be run', function() {
      var cmdTest, cmdRun;
      var cmd = {
        test: function(cmd) {
          cmdTest = true;
          return true;
        },
        run: function(args, done, next) {
          cmdRun = true;
          next();
        }
      };
      Terminal.addCommand(cmd);

      terminal.evalInput('testing');
      expect(cmdTest).to.equal(true);
      expect(cmdRun).to.equal(true);
      expect(testCalled).to.equal(true);

      Terminal.removeCommand(cmd);
    });

    it('added command via regex that return false in test method dont run', function() {
      var cmdTest, cmdRun;
      var cmd = {
        test: function(cmd) {
          cmdTest = true;
          return false;
        },
        run: function(args, done, next) {
          cmdRun = true;
          next();
        }
      };
      Terminal.addCommand(cmd);

      terminal.evalInput('testing');
      expect(cmdTest).to.equal(true);
      expect(cmdRun).to.equal(undefined);
      expect(testCalled).to.equal(true);

      Terminal.removeCommand(cmd);
    });

    it('alias can be added via simple string, string params', function() {
      Terminal.addCommand('mytest', 'test');

      terminal.evalInput('mytest');

      expect(testCalled).to.equal(true);
    });

    it('after adding alias the real command still works', function() {
      Terminal.addCommand('mytest', 'test');

      terminal.evalInput('test');

      expect(testCalled).to.equal(true);
    });
  });
});
