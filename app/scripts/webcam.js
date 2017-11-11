/**
 * Webcam Directive
 *
 * (c) Jonas Hartmann http://jonashartmann.github.io/webcam-directive
 * License: MIT
 *
 * @version: 3.2.0
 */

(function () {
  'use strict';

  angular.module('webcam', [])
    .factory('webcamService', WebcamService)
    .directive('webcam', WebcamDirective);

  WebcamService.$inject = ['$q'];
  function WebcamService($q) {
    var navigatorGetUserMedia = (navigator.getUserMedia || navigator.webKitGetUserMedia || navigator.moxGetUserMedia ||
      navigator.mozGetUserMedia || navigator.msGetUserMedia);
    var constraints = { audio: false, video: true };
    return {
      isUserMediaSupported: function () {
        return navigatorGetUserMedia ||
          (navigator.mediaDevices === undefined && navigator.mediaDevices.getUserMedia === undefined);
      },
      getUserMedia: function () {
        return $q(function (resolve, reject) {
          if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia(constraints).then(resolve).catch(reject);
          } else {
            navigatorGetUserMedia(constraints, resolve, reject);
          }
        });
      }
    };
  }

  WebcamDirective.$inject = ['webcamService'];
  function WebcamDirective(webcamService) {
    return {
      template: '<div class="webcam" ng-transclude></div>',
      restrict: 'E',
      replace: true,
      transclude: true,
      scope:
      {
        onError: '&',
        onStream: '&',
        onStreaming: '&',
        placeholder: '=',
        config: '=channel'
      },
      link: function postLink($scope, element) {
        var videoElem = null,
          videoStream = null,
          placeholder = null;

        $scope.config = $scope.config || {};

        var _removeDOMElement = function _removeDOMElement(DOMel) {
          if (DOMel) {
            angular.element(DOMel).remove();
          }
        };

        var onDestroy = function onDestroy() {
          if (!!videoStream) {
            var checker = typeof videoStream.getVideoTracks === 'function';
            if (videoStream.getVideoTracks && checker) {
              // get video track to call stop in it
              // videoStream.stop() is deprecated and may be removed in the
              // near future
              // ENSURE THIS IS CHECKED FIRST BEFORE THE FALLBACK
              // videoStream.stop()
              var tracks = videoStream.getVideoTracks();
              if (tracks && tracks[0] && tracks[0].stop) {
                tracks[0].stop();
              }
            } else if (videoStream.stop) {
              // deprecated, may be removed in the near future
              videoStream.stop();
            }
          }
          if (!!videoElem) {
            delete videoElem.src;
          }
        };

        // called when camera stream is loaded
        var onSuccess = function onSuccess(stream) {
          videoStream = stream;

          var vendorURL = window.URL || window.webkitURL;
          // Older browsers may not have srcObject
          if ('srcObject' in videoElem) {
            videoElem.srcObject = stream;
          } else if ('mozSrcObject' in videoElem) {
            videoElem.mozSrcObject = stream;
          } else {
            // Avoid using this in new browsers, as it is going away
            videoElem.src = vendorURL.createObjectURL(stream);
          }

          /* Start playing the video to show the stream from the webcam */
          videoElem.play();
          $scope.config.video = videoElem;

          /* Call custom callback */
          if ($scope.onStream) {
            $scope.onStream({ stream: stream });
          }
        };

        // called when any error happens
        var onFailure = function onFailure(err) {
          _removeDOMElement(placeholder);
          if (console && console.log) {
            console.log('The following error occured: ', err);
          }

          /* Call custom callback */
          if ($scope.onError) {
            $scope.onError({ err: err });
          }

          return;
        };

        var startWebcam = function startWebcam() {
          videoElem = document.createElement('video');
          videoElem.setAttribute('class', 'webcam-live');
          videoElem.setAttribute('autoplay', '');
          element.append(videoElem);

          if ($scope.placeholder) {
            placeholder = document.createElement('img');
            placeholder.setAttribute('class', 'webcam-loader');
            placeholder.src = $scope.placeholder;
            element.append(placeholder);
          }

          // Default variables
          var isStreaming = false,
            width = element.width = $scope.config.videoWidth || 320,
            height = element.height = 0;

          // Check the availability of getUserMedia across supported browsers
          if (!webcamService.isUserMediaSupported()) {
            onFailure({ code: -1, msg: 'Browser does not support getUserMedia.' });
            return;
          }

          var mediaConstraint = { video: true, audio: false };
          webcamService.getUserMedia(mediaConstraint).then(onSuccess).catch(onFailure);

          /* Start streaming the webcam data when the video element can play
           * It will do it only once
           */
          videoElem.addEventListener('canplay', function () {
            if (!isStreaming) {
              var scale = width / videoElem.videoWidth;
              height = (videoElem.videoHeight * scale) ||
                $scope.config.videoHeight;
              videoElem.setAttribute('width', width);
              videoElem.setAttribute('height', height);
              isStreaming = true;

              $scope.config.video = videoElem;

              _removeDOMElement(placeholder);

              /* Call custom callback */
              if ($scope.onStreaming) {
                $scope.onStreaming();
              }
            }
          }, false);
        };

        var stopWebcam = function stopWebcam() {
          onDestroy();
          videoElem.remove();
        };

        $scope.$on('$destroy', onDestroy);
        $scope.$on('START_WEBCAM', startWebcam);
        $scope.$on('STOP_WEBCAM', stopWebcam);

        startWebcam();

      }
    };
  }

})();
