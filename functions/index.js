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
  let inputContexts = request.body.result.contexts; // https://dialogflow.com/docs/contexts
  let requestSource = (request.body.originalRequest) ? request.body.originalRequest.source : undefined;
  const googleAssistantRequest = 'google'; // Constant to identify Google Assistant requests
  const app = new DialogflowApp({
    request: request,
    response: response
  });
  let access_token = app.getUser().access_token;
  const actionsApp = new ActionsSdkApp({
    request: request,
    response: response
  });
  // Create handlers for Dialogflow actions as well as a 'default' handler
  const actionHandlers = {
    'signin': () => {
      console.log('signin');
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('This is the signin action');
      } else {
        sendResponse('This is the signin action');
      }
    },
    'create.alarm': () => {
      console.log('create.alarm');
      if (!app.getDeviceLocation()) {
        // let state = {
        //   "previous_intent": "create.alarm"
        // };
        app.userStorage.previous_intent = "create.alarm";
        app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
      } else {
        let deviceCoordinates = app.getDeviceLocation().coordinates;
        console.log(deviceCoordinates);

        // createAlarm(app);
        // let deviceCoordinates = app.getDeviceLocation().coordinates;
        // console.log(deviceCoordinates);
        let requestData = JSON.stringify({
          "services": {
            "police": true,
            "fire": false,
            "medical": false
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
        console.log("User storage 0:", app.userStorage);
        let req = https.request(options, function(res) {
          res.setEncoding('utf8');
          res.on('data', function(body) {
            console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
            // if (res.statusCode == 201) {
            // console.log("THIS IS A TEST CAN YOU HEAR ME");
            // console.log("Body 201: ", JSON.parse(body));
            let id = JSON.parse(body).id;
            // console.log("ID 201: ", id);
            // console.log("User storage 1:", app.userStorage);
            app.userStorage.id = id;
            // console.log("User storage ID:", app.userStorage.id);
            // console.log("User storage 2:", app.userStorage);
            // }
            let responseString = "We have sent the police to your location\n\n"+JSON.stringify(body);
            let bodyString = JSON.stringify(body);
            if (requestSource === googleAssistantRequest) {
              sendGoogleResponse(responseString);
            } else {
              sendResponse(responseString);
            }
          });
        });
        console.log("Request data", requestData);
        req.on('error', function(e) {
          console.log('problem with request: ' + e.message);
        });
        req.write(requestData);
        req.end();
      }
    },
    'user.info': () => {
      // const dialogState = actionsApp.getDialogState().previous_intent;
      if (app.isPermissionGranted()) {
        console.log("actionsApp.getDialogState()", app.userStorage);
        console.log("previous_intent", app.userStorage.previous_intent);
        // console.log("action", actionHandlers[dialogState]);
        if (app.userStorage.previous_intent) {
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
      if (!app.getDeviceLocation()) {
        // let state = {
        //   "previous_intent": "update.alarm.status"
        // };
        app.userStorage.previous_intent = "update.alarm.status";
        app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION);
      } else {
        let deviceCoordinates = app.getDeviceLocation().coordinates;
        console.log(deviceCoordinates);
        // console.log("User storage 3:", app.userStorage);
        // console.log("User storage ID:", app.userStorage.id);
        // console.log("User storage 4:", app.userStorage);
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
            // 200
            res.setEncoding('utf8');
            res.on('data', function(body) {
              console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
              let responseString = "We've canceled your alarm.\n\n"+JSON.stringify(body);
              if (requestSource === googleAssistantRequest) {
                sendGoogleResponse(responseString);
              } else {
                sendResponse(responseString);
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
    },
    'update.alarm.location': () => {
      console.log('update.alarm.location');
      if (!app.getDeviceLocation()) {
        let state = {
          "previous_intent": "update.alarm.location"
        };
        app.askForPermission('To locate you', app.SupportedPermissions.DEVICE_PRECISE_LOCATION, state);
      } else {
        let deviceCoordinates = app.getDeviceLocation().coordinates;
        console.log(deviceCoordinates);
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
            // 200
            res.setEncoding('utf8');
            res.on('data', function(body) {
              console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
              let string = "We've updated your location.\n\n"+JSON.stringify(body);
              if (requestSource === googleAssistantRequest) {
                sendGoogleResponse(string);
              } else {
                sendResponse(string);
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
    },
    // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
    'input.welcome': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
      } else {
        sendResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
      }
    },
    // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
    'input.unknown': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        sendGoogleResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      } else {
        sendResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
      }
    },
    // Default handler for unknown or undefined actions
    'default': () => {
      // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
      if (requestSource === googleAssistantRequest) {
        let responseToUser = {
          //googleRichResponse: googleRichResponse, // Optional, uncomment to enable
          //googleOutputContexts: ['weather', 2, { ['city']: 'rome' }], // Optional, uncomment to enable
          speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
          text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
        };
        sendGoogleResponse(responseToUser);
      } else {
        let responseToUser = {
          //data: richResponsesV1, // Optional, uncomment to enable
          //outputContexts: [{'name': 'weather', 'lifespan': 2, 'parameters': {'city': 'Rome'}}], // Optional, uncomment to enable
          speech: 'This message is from Dialogflow\'s Cloud Functions for Firebase editor!', // spoken response
          text: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
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
// Construct rich response for Google Assistant (v1 requests only)
const app = new DialogflowApp();
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
/*
 * Function to handle v2 webhook requests from Dialogflow
 */
// function processV2Request(request, response) {
//   // An action is a string used to identify what needs to be done in fulfillment
//   let action = (request.body.queryResult.action) ? request.body.queryResult.action : 'default';
//   // Parameters are any entites that Dialogflow has extracted from the request.
//   let parameters = request.body.queryResult.parameters || {}; // https://dialogflow.com/docs/actions-and-parameters
//   // Contexts are objects used to track and store conversation state
//   let inputContexts = request.body.queryResult.contexts; // https://dialogflow.com/docs/contexts
//   // Get the request source (Google Assistant, Slack, API, etc)
//   let requestSource = (request.body.originalDetectIntentRequest) ? request.body.originalDetectIntentRequest.source : undefined;
//   // Get the session ID to differentiate calls from different users
//   let session = (request.body.session) ? request.body.session : undefined;
//   const googleAssistantRequest = 'google'; // Constant to identify Google Assistant requests
//   const app = new DialogflowApp({request: request, response: response});
//   let access_token = app.getUser().access_token;
//   // Create handlers for Dialogflow actions as well as a 'default' handler
//   const actionHandlers = {
//     'signin': () => {
//       console.log('signin');
//       if (requestSource === googleAssistantRequest) {
//         sendGoogleResponse('This is the signin action');
//       } else {
//         sendResponse('This is the signin action');
//       }
//     },
//     'create.alarm': () => {
//       console.log('create.alarm');
//       createAlarm(access_token);
//       if (requestSource === googleAssistantRequest) {
//         sendGoogleResponse('This is the create alarm action');
//       } else {
//         sendResponse('This is the create alarm action');
//       }
//     },
//     'update.alarm.status': () => {
//       console.log('update.alarm.status');
//       updateAlarmStatus(access_token);
//       if (requestSource === googleAssistantRequest) {
//         sendGoogleResponse('This is the update alarm status action');
//       } else {
//         sendResponse('This is the update alarm action action');
//       }
//     },
//     // The default welcome intent has been matched, welcome the user (https://dialogflow.com/docs/events#default_welcome_intent)
//     'input.welcome': () => {
//       console.log('input.welcome');
//       sendResponse('Hello, Welcome to my Dialogflow agent!'); // Send simple response to user
//     },
//     // The default fallback intent has been matched, try to recover (https://dialogflow.com/docs/intents#fallback_intents)
//     'input.unknown': () => {
//       console.log('input.unknown');
//       // Use the Actions on Google lib to respond to Google requests; for other requests use JSON
//       sendResponse('I\'m having trouble, can you try that again?'); // Send simple response to user
//     },
//     // Default handler for unknown or undefined actions
//     'default': () => {
//       let responseToUser = {
//         //fulfillmentMessages: richResponsesV2, // Optional, uncomment to enable
//         //outputContexts: [{ 'name': `${session}/contexts/weather`, 'lifespanCount': 2, 'parameters': {'city': 'Rome'} }], // Optional, uncomment to enable
//         fulfillmentText: 'This is from Dialogflow\'s Cloud Functions for Firebase editor! :-)' // displayed response
//       };
//       sendResponse(responseToUser);
//     }
//   };
//   // If undefined or unknown action use the default handler
//   if (!actionHandlers[action]) {
//     action = 'default';
//   }
//   // Run the proper handler function to handle the request from Dialogflow
//   actionHandlers[action]();
//   // Function to send correctly formatted responses to Dialogflow which are then sent to the user
//   function sendResponse(responseToUser) {
//     // if the response is a string send it as a response to the user
//     if (typeof responseToUser === 'string') {
//       let responseJson = {
//         fulfillmentText: responseToUser
//       }; // displayed response
//       response.json(responseJson); // Send response to Dialogflow
//     } else {
//       // If the response to the user includes rich responses or contexts send them to Dialogflow
//       let responseJson = {};
//       // Define the text response
//       responseJson.fulfillmentText = responseToUser.fulfillmentText;
//       // Optional: add rich messages for integrations (https://dialogflow.com/docs/rich-messages)
//       if (responseToUser.fulfillmentMessages) {
//         responseJson.fulfillmentMessages = responseToUser.fulfillmentMessages;
//       }
//       // Optional: add contexts (https://dialogflow.com/docs/contexts)
//       if (responseToUser.outputContexts) {
//         responseJson.outputContexts = responseToUser.outputContexts;
//       }
//       // Send the response to Dialogflow
//       console.log('Response to Dialogflow: ' + JSON.stringify(responseJson));
//       response.json(responseJson);
//     }
//   }
// }
// const richResponseV2Card = {
//   'title': 'Title: this is a title',
//   'subtitle': 'This is an subtitle.  Text can include unicode characters including emoji 📱.',
//   'imageUri': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
//   'buttons': [{
//     'text': 'This is a button',
//     'postback': 'https://assistant.google.com/'
//   }]
// };
// const richResponsesV2 = [{
//     'platform': 'ACTIONS_ON_GOOGLE',
//     'simple_responses': {
//       'simple_responses': [{
//         'text_to_speech': 'Spoken simple response',
//         'display_text': 'Displayed simple response'
//       }]
//     }
//   },
//   {
//     'platform': 'ACTIONS_ON_GOOGLE',
//     'basic_card': {
//       'title': 'Title: this is a title',
//       'subtitle': 'This is an subtitle.',
//       'formatted_text': 'Body text can include unicode characters including emoji 📱.',
//       'image': {
//         'image_uri': 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png'
//       },
//       'buttons': [{
//         'title': 'This is a button',
//         'open_uri_action': {
//           'uri': 'https://assistant.google.com/'
//         }
//       }]
//     }
//   },
//   {
//     'platform': 'FACEBOOK',
//     'card': richResponseV2Card
//   },
//   {
//     'platform': 'SLACK',
//     'card': richResponseV2Card
//   }
// ];

function createAlarm(app) {
  let deviceCoordinates = app.getDeviceLocation().coordinates;
  console.log(deviceCoordinates);
  let requestData = JSON.stringify({
    "services": {
      "police": true,
      "fire": false,
      "medical": false
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
      console.log("Status: ", res.statusCode, "Headers: ", JSON.stringify(res.headers), "Body: ", body);
      // if (res.statusCode == 201) {
      console.log("THIS IS A TEST CAN YOU HEAR ME");
      console.log("Body 201: ", JSON.parse(body));
      let id = JSON.parse(body).id;
      console.log("ID 201: ", id);
      console.log("User storage:", app.userStorage);
      app.userStorage.id = id;
      console.log("User storage ID:", app.userStorage.id);
      console.log("User storage 2:", app.userStorage);
      // }
    });
  });
  console.log("Request", req);
  console.log("Request data", requestData);
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  // write data to request body
  req.write(requestData);
  req.end();
}

function updateAlarmLocation(app) {
  let deviceCoordinates = app.getDeviceLocation().coordinates;
  console.log(deviceCoordinates);
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
    // 200
    console.log('Status: ' + res.statusCode);
    console.log('Headers: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function(body) {
      console.log('Body: ' + body);
      return body.toString();
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });
  // write data to request body
  req.write(requestData);
  req.end();
}

function updateAlarmStatus(app) {
  console.log("User storage 3:", app.userStorage);
  console.log("User storage ID:", app.userStorage.id);
  console.log("User storage 4:", app.userStorage);
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + app.getUser().access_token,
      }
    };
    let req = https.request(options, function(res) {
      // 200
      console.log('Status: ' + res.statusCode);
      console.log('Headers: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function(body) {
        console.log('Body: ' + body);
        return body.toString();
      });
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });
    // write data to request body
    req.write(requestData);
    req.end();
  }
}
