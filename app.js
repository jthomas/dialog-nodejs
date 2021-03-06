/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express  = require('express'),
  app        = express(),
  fs         = require('fs'),
  path       = require('path'),
  bluemix    = require('./config/bluemix'),
  extend     = require('util')._extend,
  watson     = require('watson-developer-cloud');

// Bootstrap application settings
require('./config/express')(app);

// if bluemix credentials exists, then override local
var dialog_credentials = extend({
  version: 'v1'
}, bluemix.getServiceCreds('dialog')); // VCAP_SERVICES

var tone_credentials = extend({
  version: 'v3-beta',
  version_date: '2016-02-11'
}, bluemix.getServiceCreds('tone_analyzer'));

var dialog_id_in_json = (function() {
  try {
    var dialogsFile = path.join(path.dirname(__filename), 'dialogs', 'dialog-id.json');
    var obj = JSON.parse(fs.readFileSync(dialogsFile));
    return obj[Object.keys(obj)[0]].id;
  } catch (e) {
  }
})();


var dialog_id = process.env.DIALOG_ID || dialog_id_in_json || '<missing-dialog-id>';

// Create the service wrapper
var dialog = watson.dialog(dialog_credentials);
var tone_analyzer = watson.tone_analyzer(tone_credentials);

app.post('/conversation', function(req, res, next) {

  req.body.input = req.body.input || "Hello"
  tone_analyzer.tone({ text: req.body.input }, function(err, tone) {
    if (err)
      return next(err);

    var categories = tone.document_tone.tone_categories
    var emotion_tones = categories.find(function (tone) {
      return tone.category_id === 'emotion_tone'
    })

    var anger_tone = emotion_tones.tones.find(function (tone) {
      return tone.tone_id === 'anger'
    })

    var params = {client_id: req.body.client_id, dialog_id: dialog_id, name_values: [{name: 'anger', value: anger_tone.score}]}
    dialog.updateProfile(params, function (err, results) {
      if (err) return console.error(err)

      var params = extend({ dialog_id: dialog_id }, req.body);
      dialog.conversation(params, function(err, results) {
        if (err)
          return next(err);
        else
          res.json({ dialog_id: dialog_id, conversation: results});
      });
    })
  });
});

app.post('/profile', function(req, res, next) {
  var params = extend({ dialog_id: dialog_id }, req.body);
  dialog.getProfile(params, function(err, results) {
    if (err)
      return next(err);
    else
      res.json(results);
  });
});

// error-handler settings
require('./config/error-handler')(app);

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);
