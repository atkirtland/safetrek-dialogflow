# safetrek-dialogflow

### An implementation of the SafeTrek API for Dialogflow Agents

Try this on Google Assistant under "SafeTrek Helper"!

This program was written in Node.js for a Dialogflow chatbot. It uses Firebase Cloud Functions to handle webhook requests.

First, sign into SafeTrek on a Google Assistant device using account linking. Second, you must agree to allow your location to be shared with Google in order to use any of the three following functions. This will be prompted upon asking for any other command. Location permissions must be requested for each new conversation, by Google's requirement.

To make an alarm, say something like "Send firefighters and doctors my way". You can ask for any combination of police, firemen, and medical assistance.

To update your location as you move from danger, simply ask for your location to be updated.

If you feel safe once more, ask for your alarm to be disabled or removed.

Sample Google Assistant conversation:

![Image](https://github.com/atkirtland/safetrek-dialogflow/blob/master/safetrek1.png)
![Image](https://github.com/atkirtland/safetrek-dialogflow/blob/master/safetrek2.png)
