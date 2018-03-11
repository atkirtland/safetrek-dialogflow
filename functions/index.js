'use strict';

var http = require("http");
var https = require("https");

const functions = require('firebase-functions'); // Cloud Functions for Firebase library
const DialogflowApp = require('actions-on-google').DialogflowApp; // Google Assistant helper library
const ActionsSdkApp = require('actions-on-google').ActionsSdkApp;
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  if (request.body.result) {
    processV1Request(request, response);
  } else if (request.body.queryResult) {
    // processV2Request(request, response);
  } else {
    console.log('Invalid Request');
    return response.status(400).end('Invalid Webhook Request (expecting v1 or v2 webhook request)');
  }
});


/*
 * Function to handle v1 webhook requests from Dialogflow
 */
function processV1Request(request, response) {
  let action = request.body.result.action; // https://dialogflow.com/docs/actions-and-parameters
  let parameters = request.body.result.parameters; // https://dialogflow.com/docs/actions-and-parameters
  console.log(parameters);
  let inputContexts = request.body.result.contexts; // https://dialogflow.com/docs/contexts
  let requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
  const googleAssistantRequest = 'google'; // Constant to identify Google Assistant requests
  const actionsApp = new ActionsSdkApp({
    request: request,
    response: response
  });
  const app = new DialogflowApp({
    request: request,
    response: response
  });
  // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
    'signin': () => {
      console.log('signin');
      if (app.getSignInStatus() === app.SignInStatus.OK) {
        if (app.userStorage['previous_intent']) {
          actionHandlers[app.userStorage.previous_intent]();
        } else {
          actionHandlers["create.alarm"]();
        }
      } else {
        let responseString = "Sorry, you must sign in to SafeTrek to use alarms.";
        if (requestSource === googleAssistantRequest) {
          sendGoogleResponse(responseString);
        } else {
          sendResponse(responseString);
        }
      }
    },
    'create.alarm': () => {
      console.log('create.alarm');
      if (!app.getUser()) {
        app.userStorage.parameters = parameters;
        app.userStorage.previous_intent = "create.alarm";
        app.askForSignIn();
      } else {
        if (!app.getDeviceLocation()) {
          app.userStorage.parameters = parameters;
          app.userStorage.previous_intent = "create.alarm";
          app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
        } else {
          actionHandlers['createAlarm']();
          // createAlarm(app, requestSource, parameters);
        }
      }
    },
    'logme': () => {
      console.log("hello");
    },
    'user.info': () => {
      if (app.isPermissionGranted()) {
        console.log("app.userStorage", app.userStorage);
        if (app.userStorage['previous_intent']) {
          actionHandlers[app.userStorage.previous_intent]();
        } else {
          actionHandlers["create.alarm"]();
        }
      } else {
        let responseString = "Sorry, you must give location permission for alarms.";
        if (requestSource === googleAssistantRequest) {
          sendGoogleResponse(responseString);
        } else {
          sendResponse(responseString);
        }
      }
    },
    'update.alarm.status': () => {
      console.log('update.alarm.status');
      if (!app.getUser()) {
        app.userStorage.previous_intent = "update.alarm.status";
        app.askForSignIn();
      } else {
        if (!app.getDeviceLocation()) {
          app.userStorage.previous_intent = "update.alarm.status";
          app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
        } else {
          let deviceCoordinates = app.getDeviceLocation().coordinates;
          console.log(deviceCoordinates);
          if (!app.userStorage.id) {
            console.log("ID NULL FAILURE");
          } else {
            let requestData = JSON.stringify({
              "status": "CANCELED"
            });
            let options = {
              // hostname: "https://api.safetrek.io/v1/alarms",
              hostname: "api-sandbox.safetrek.io",
              path: "/v1/alarms/" + app.userStorage.id + "/status",
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + app.getUser().access_token,
              }
            };
            let req = https.request(options, function(res) {
              res.setEncoding('utf8');
              res.on('data', function(body) {
                var string;
                var details = "";
                if (res.statusCode == 200) {
                  string = "We've canceled your alarm. Thank you for using SafeTrek to stay out of danger. ";
                  console.log("Cancelling timer...", app.userStorage);
                  clearInterval(app.userStorage.timer);
                } else {
                  console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
                  string = "We were unable to cancel your alarm. ";
                  details = body;
                }
                let response = {
                  speech: string,
                  displayText: string + details
                };
                if (requestSource === googleAssistantRequest) {
                  sendGoogleResponse(response);
                } else {
                  sendResponse(response);
                }
              });
            });
            req.on('error', function(e) {
              console.log('problem with request: ' + e.message);
            });
            req.write(requestData);
            req.end();
          }
        }
      }
    },
    'update.alarm.location': () => {
      console.log('update.alarm.location');
      if (!app.getUser()) {
        app.userStorage.previous_intent = "update.alarm.location";
        app.askForSignIn();
      } else {
        if (!app.getDeviceLocation()) {
          app.userStorage.previous_intent = "update.alarm.location";
          app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
        } else {
          // updateAlarmLocation(app, requestSource, true);
          actionHandlers['updateAlarmLocation'](true);
        }
      }
    },
    'input.welcome': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      let responseString = 'Hello, Welcome to SafeTrek Helper!';
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse(responseString); // Send simple response to user
      } else {
        sendResponse(responseString); // Send simple response to user
      }
    },
    // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
    'input.unknown': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      let responseString = 'I\'m having trouble, can you try that again?';
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse(responseString); // Send simple response to user
      } else {
        sendResponse(responseString); // Send simple response to user
      }
    },
    'updateAlarmLocation': (sendResponse) => {
      sendResponse = sendResponse || false;
      let deviceCoordinates = app.getDeviceLocation().coordinates;
      if (!app.userStorage.id) {
        console.log("ID NULL FAILURE");
      } else {
        let requestData = JSON.stringify({
          "coordinates": {
            "lat": deviceCoordinates.latitude,
            "lng": deviceCoordinates.longitude,
            "accuracy": 5
          }
        });
        let options = {
          // hostname: "https://api.safetrek.io/v1/alarms",
          hostname: "api-sandbox.safetrek.io",
          path: "/v1/alarms/" + app.userStorage.id + "/locations",
          method: "POST",
          headers: {
            "Authorization": "Bearer " + app.getUser().access_token,
            "Content-Type": "application/json"
          }
        };
        let req = https.request(options, function(res) {
          res.setEncoding('utf8');
          res.on('data', function(body) {
            let bodyObj = JSON.parse(body);
            var string;
            var details = "";
            console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
            if (res.statusCode == 200) {
              string = "We've updated your location. ";
              details += "Your new location is " + bodyObj.coordinates.lat + ", " + bodyObj.coordinates.lng + ". The time is " + (new Date(bodyObj.coordinates.created_at)).toTimeString() + ". ";
            } else {
              string = "We were unable to update your location. ";
              details = JSON.stringify(body);
            }
            let response = {
              speech: string + details,
              displayText: string + details
            };
            if (sendResponse) {
              if (requestSource === googleAssistantRequest) {
                sendGoogleResponse(response);
              } else {
                sendResponse(response);
              }

            }
          });
        });
        req.on('error', function(e) {
          console.log('problem with request: ' + e.message);
        });
        req.write(requestData);
        req.end();
      }
    },
    'createAlarm': () => {
      let deviceCoordinates = app.getDeviceLocation().coordinates;
      let p = parameters.type ? parameters : app.userStorage.parameters;
      let police = p['type'].includes('police');
      let fire = p['type'].includes('fire');
      let medical = p['type'].includes('medical');
      if (!(police || fire || medical)) {
        police = true;
      }
      let requestData = JSON.stringify({
        "services": {
          "police": police,
          "fire": fire,
          "medical": medical
        },
        "location.coordinates": {
          "lat": deviceCoordinates.latitude,
          "lng": deviceCoordinates.longitude,
          "accuracy": 5
        }
      });
      let options = {
        // hostname: "https://api.safetrek.io/v1/alarms",
        hostname: "api-sandbox.safetrek.io",
        path: "/v1/alarms",
        method: "POST",
        headers: {
          "Authorization": "Bearer " + app.getUser().access_token,
          "Content-Type": "application/json",
        }
      };
      let req = https.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(body) {
          let bodyObj = JSON.parse(body);
          app.userStorage.id = bodyObj.id;
          var string;
          var details = "";
          console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
          if (res.statusCode == 201) {
            string = "We have sent help. ";
            details += "The following services are coming:" + (bodyObj.services.police ? " police" : "") + (bodyObj.services.fire ? " fire" : "") + (bodyObj.services.medical ? " medical" : "") + ". ";
            details += "You location is: " + bodyObj.locations.coordinates[0].lat + ", " + bodyObj.locations.coordinates[0].lng + ". ";
            details += "This alarm was created at " + (new Date(bodyObj.created_at)).toString() + ". ";
          } else {
            string = "There's an error creating the alarm.";
            details = JSON.stringify(body);
          }
          let response = { // TODO this could be the source of the problems..
            speech: string + details,
            displayText: string + details
          };
          setInterval(actionHandlers['updateAlarmLocation'], 10 * 1000);
          if (requestSource === googleAssistantRequest) {
            sendGoogleResponse(response);
          } else {
            sendResponse(response);
          }
        });
      });
      req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
      });
      req.write(requestData);
      req.end();
      // setInterval(function() {
      //   console.log("hello");
      // }, 10 * 1000);
      // setInterval(actionHandlers['updateAlarmLocation'], 10 * 1000, app, requestSource);
    },
    // Default handler for unknown or undefined actions
    'default': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      let responseString = "We don't know how to handle your request.";
      if (requestSource === googleAssistantRequest) {
        let responseToUser = {
          //googleRichResponse: googleRichResponse, // Optional, uncomment to enable
          //googleOutputContexts: ['weather', 2, { ['city']: 'rome' }], // Optional, uncomment to enable
          speech: responseString, // spoken response
          text: responseString // displayed response
        };
        sendGoogleResponse(responseToUser);
      } else {
        let responseToUser = {
          //data: richResponsesV1, // Optional, uncomment to enable
          //outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
          speech: responseString, // spoken response
          text: responseString // displayed response
        };
        sendResponse(responseToUser);
      }
    }
  };
  // If undefined or unknown action use the default handler
  if (!actionHandlers[action]) {
    action = 'default';
  }
  // Run the proper handler function to handle the request from Dialogflow
  actionHandlers[action]();
  // Function to send correctly formatted Google Assistant responses to Dialogflow which are then sent to the user
  function sendGoogleResponse(responseToUser) {
    if (typeof responseToUser === 'string') {
      app.ask(responseToUser); // Google Assistant response
    } else {
      // If speech or displayText is defined use it to respond
      let googleResponse = app.buildRichResponse().addSimpleResponse({
        speech: responseToUser.speech || responseToUser.displayText,
        displayText: responseToUser.displayText || responseToUser.speech
      });
      // Optional: Overwrite previous response with rich response
      if (responseToUser.googleRichResponse) {
        googleResponse = responseToUser.googleRichResponse;
      }
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      if (responseToUser.googleOutputContexts) {
        app.setContext(...responseToUser.googleOutputContexts);
      }
      console.log('Response to Dialogflow (AoG): ' + JSON.stringify(googleResponse));
      app.ask(googleResponse); // Send response to Dialogflow and Google Assistant
    }
  }
  // Function to send correctly formatted responses to Dialogflow which are then sent to the user
  function sendResponse(responseToUser) {
    // if the response is a string send it as a response to the user
    if (typeof responseToUser === 'string') {
      let responseJson = {};
      responseJson.speech = responseToUser; // spoken response
      responseJson.displayText = responseToUser; // displayed response
      response.json(responseJson); // Send response to Dialogflow
    } else {
      // If the response to the user includes rich responses or contexts send them to Dialogflow
      let responseJson = {};
      // If speech or displayText is defined, use it to respond (if one isn't defined use the other's value)
      responseJson.speech = responseToUser.speech || responseToUser.displayText;
      responseJson.displayText = responseToUser.displayText || responseToUser.speech;
      // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
      responseJson.data = responseToUser.data;
      // Optional: add contexts (https://dialogflow.com/docs/contexts)
      responseJson.contextOut = responseToUser.outputContexts;
      console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
      response.json(responseJson); // Send response to Dialogflow
    }
  }
}
const app = new DialogflowApp();

// Construct rich response for Google Assistant (v1 requests only)
const googleRichResponse = app.buildRichResponse()
  .addSimpleResponse('This is the first simple response for Google Assistant')
  .addSuggestions(
    ['Suggestion Chip', 'Another Suggestion Chip'])
  // Create a basic card and add it to the rich response
  .addBasicCard(app.buildBasicCard(`This is a basic card.  Text in a
 basic card can include "quotes" and most other unicode characters
 including emoji 📱.  Basic cards also support some markdown
 formatting like *emphasis* or _italics_, **strong** or __bold__,
 and ***bold itallic*** or ___strong emphasis___ as well as other things
 like line  \nbreaks`) // Note the two spaces before '\n' required for a
    // line break to be rendered in the card
    .setSubtitle('This is a subtitle')
    .setTitle('Title: this is a title')
    .addButton('This is a button', 'https://assistant.google.com/')
    .setImage('https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
      'Image alternate text'))
  .addSimpleResponse({
    speech: 'This is another simple response',
    displayText: 'This is the another simple response 💁'
  });
// Rich responses for Slack and Facebook for v1 webhook requests
const richResponsesV1 = {
  'slack': {
    'text': 'This is a text response for Slack.',
    'attachments': [{
      'title': 'Title: this is a title',
      'title_link': 'https://assistant.google.com/',
      'text': 'This is an attachment.  Text in attachments can include \'quotes\' and most other unicode characters including emoji 📱.  Attachments also upport line\nbreaks.',
      'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
      'fallback': 'This is a fallback.'
    }]
  },
  'facebook': {
    'attachment': {
      'type': 'template',
      'payload': {
        'template_type': 'generic',
        'elements': [{
          'title': 'Title: this is a title',
          'image_url': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
          'subtitle': 'This is a subtitle',
          'default_action': {
            'type': 'web_url',
            'url': 'https://assistant.google.com/'
          },
          'buttons': [{
            'type': 'web_url',
            'url': 'https://assistant.google.com/',
            'title': 'This is a button'
          }]
        }]
      }
    }
  }
};

// function createAlarm(app, requestSource, parameters) {
//   let deviceCoordinates = app.getDeviceLocation().coordinates;
//   let p = parameters.type ? parameters : app.userStorage.parameters;
//   let police = p['type'].includes('police');
//   let fire = p['type'].includes('fire');
//   let medical = p['type'].includes('medical');
//   if (!(police || fire || medical)) {
//     police = true;
//   }
//   let requestData = JSON.stringify({
//     "services": {
//       "police": police,
//       "fire": fire,
//       "medical": medical
//     },
//     "location.coordinates": {
//       "lat": deviceCoordinates.latitude,
//       "lng": deviceCoordinates.longitude,
//       "accuracy": 5
//     }
//   });
//   let options = {
//     // hostname: "https://api.safetrek.io/v1/alarms",
//     hostname: "api-sandbox.safetrek.io",
//     path: "/v1/alarms",
//     method: "POST",
//     headers: {
//       "Authorization": "Bearer " + app.getUser().access_token,
//       "Content-Type": "application/json",
//     }
//   };
//   let req = https.request(options, function(res) {
//     res.setEncoding('utf8');
//     res.on('data', function(body) {
//       let bodyObj = JSON.parse(body);
//       app.userStorage.id = bodyObj.id;
//       var string;
//       var details = "";
//       console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
//       if (res.statusCode == 201) {
//         string = "We have sent help. ";
//         details += "The following services are coming:" + (bodyObj.services.police ? " police" : "") + (bodyObj.services.fire ? " fire" : "") + (bodyObj.services.medical ? " medical" : "") + ". ";
//         details += "You location is: " + bodyObj.locations.coordinates[0].lat + ", " + bodyObj.locations.coordinates[0].lng + ". ";
//         details += "This alarm was created at " + (new Date(bodyObj.created_at)).toString() + ". ";
//       } else {
//         string = "There's an error creating the alarm.";
//         details = JSON.stringify(body);
//       }
//       let response = { // TODO this could be the source of the problems..
//         speech: string + details,
//         displayText: string + details
//       };
//       if (requestSource === googleAssistantRequest) {
//         sendGoogleResponse(response);
//       } else {
//         sendResponse(response);
//       }
//     });
//   });
//   req.on('error', function(e) {
//     console.log('problem with request: ' + e.message);
//   });
//   req.write(requestData);
//   req.end();
//   // setInterval(function() {
//   //   console.log("hello");
//   // }, 10 * 1000);
//   setInterval(updateAlarmLocation, 10 * 1000, app, requestSource);
// }
//
// function updateAlarmLocation(app, requestSource, sendResponse) {
//   sendResponse = sendResponse || false;
//   let deviceCoordinates = app.getDeviceLocation().coordinates;
//   if (!app.userStorage.id) {
//     console.log("ID NULL FAILURE");
//   } else {
//     let requestData = JSON.stringify({
//       "coordinates": {
//         "lat": deviceCoordinates.latitude,
//         "lng": deviceCoordinates.longitude,
//         "accuracy": 5
//       }
//     });
//     let options = {
//       // hostname: "https://api.safetrek.io/v1/alarms",
//       hostname: "api-sandbox.safetrek.io",
//       path: "/v1/alarms/" + app.userStorage.id + "/locations",
//       method: "POST",
//       headers: {
//         "Authorization": "Bearer " + app.getUser().access_token,
//         "Content-Type": "application/json"
//       }
//     };
//     let req = https.request(options, function(res) {
//       res.setEncoding('utf8');
//       res.on('data', function(body) {
//         let bodyObj = JSON.parse(body);
//         var string;
//         var details = "";
//         console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
//         if (res.statusCode == 200) {
//           string = "We've updated your location. ";
//           details += "Your new location is " + bodyObj.coordinates.lat + ", " + bodyObj.coordinates.lng + ". The time is " + (new Date(bodyObj.coordinates.created_at)).toTimeString() + ". ";
//         } else {
//           string = "We were unable to update your location. ";
//           details = JSON.stringify(body);
//         }
//         let response = {
//           speech: string + details,
//           displayText: string + details
//         };
//         if (sendResponse) {
//           if (requestSource === googleAssistantRequest) {
//             sendGoogleResponse(response);
//           } else {
//             sendResponse(response);
//           }
//
//         }
//       });
//     });
//     req.on('error', function(e) {
//       console.log('problem with request: ' + e.message);
//     });
//     req.write(requestData);
//     req.end();
//   }
// }
