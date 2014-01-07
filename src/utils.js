/* global Terminal */
(function(win, doc, Terminal) {
  'use strict';

  Terminal.utils = {
    createCORSRequest: function createCORSRequest(method, url){
      var xhr = new XMLHttpRequest();
      if ('withCredentials' in xhr) {
        xhr.open(method, url, true);
      } else
        if (typeof XDomainRequest !== 'undefined') {
          xhr = new XDomainRequest();
          xhr.open(method, url);
        } else {
          xhr = null;
        }
      return xhr;
    },

    loadFile: function loadFile(filename, callback) {
      var isCSS     = /\.css$/.test(filename),
          parent    = doc.getElementsByTagName('body')[0],
          script    = doc.createElement(isCSS ? 'link' : 'script'),

          isRunning = true,

          scriptLoad = function scriptLoad(event) {
            if (isRunning) {
              isRunning = false;
              callback(null, event);
            }
          },
          scriptError = function scriptError() {
            if (isRunning) {
              isRunning = false;
              callback(new Error('Could not load'));
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
  };

}(window, document, Terminal));
