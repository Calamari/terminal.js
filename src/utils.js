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
    }
  };

}(window, document, Terminal));
