describe('Terminal', function() {
  var element, clock;

  before(function() {
    $('body').append('<div id="terminal"></div>')
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
});
