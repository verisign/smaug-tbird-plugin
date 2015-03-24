/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public
 * License Version 1.1 (the "MPL"); you may not use this file
 * except in compliance with the MPL. You may obtain a copy of
 * the MPL at http://www.mozilla.org/MPL/
 *
 * Software distributed under the MPL is distributed on an "AS
 * IS" basis, WITHOUT WARRANTY OF ANY KIND, either express or
 * implied. See the MPL for the specific language governing
 * rights and limitations under the MPL.
 *
 * The Original Code is Enigmail.
 *
 * The Initial Developer of the Original Code is Ramalingam Saravanan.
 * Portions created by Ramalingam Saravanan <svn@xmlterm.org> are
 * Copyright (C) 2001 Ramalingam Saravanan. All Rights Reserved.
 *
 * Contributor(s):
 *   Patrick Brunschwig <patrick@enigmail.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

try {
  // TB with omnijar
  Components.utils.import("resource:///modules/gloda/mimemsg.js");
}
catch (ex) {
  // "old style" TB
  Components.utils.import("resource://app/modules/gloda/mimemsg.js");
}

Components.utils.import("resource://smaug/smaugCommon.jsm");
Components.utils.import("resource://smaug/commonFuncs.jsm");
Components.utils.import("resource://smaug/mimeVerify.jsm");

if (! Smaug) var Smaug = {};

Smaug.getSmaugSvc = function ()
{
  return SmaugCommon.getService(window);
};


Smaug.msg = {
  createdURIs:      [],
  decryptedMessage: null,
  securityInfo:     null,
  lastSaveDir:      "",
  messagePane:      null,
  noShowReload:     false,
  decryptButton:    null,
  savedHeaders:     null,
  removeListener:   false,
  enableExperiments: false,
  headersList:      ["content-type", "content-transfer-encoding",
                     "x-smaug-version", "x-pgp-encoding-format" ],
  buggyExchangeEmailContent: null, // for HACK for MS-EXCHANGE-Server Problem

  messengerStartup: function ()
  {

    // private function to overwrite attributes
    function overrideAttribute (elementIdList, attrName, prefix, suffix)
    {
      for (var index = 0; index < elementIdList.length; index++) {
        var elementId = elementIdList[index];
        var element = document.getElementById(elementId);
        if (element) {
          try {
            var oldValue = element.getAttribute(attrName);
            SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: overrideAttribute "+attrName+": oldValue="+oldValue+"\n");
            var newValue = prefix+elementId+suffix;

            element.setAttribute(attrName, newValue);
          } catch (ex) {}
        }
        else {
          SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: *** UNABLE to override id="+ elementId+"\n");
        }
      }
    }

    Smaug.msg.messagePane = document.getElementById("messagepane");

    if (Smaug.msg.messagePane == null) return; // TB on Mac OS X calls this twice -- once far too early

    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: Startup\n");

    // Override SMIME ui
    var viewSecurityCmd = document.getElementById("cmd_viewSecurityStatus");
    if (viewSecurityCmd) {
      viewSecurityCmd.setAttribute("oncommand", "Smaug.msg.viewSecurityInfo(null, true);");
    }

    // Override print command
    var printElementIds = ["cmd_print", "cmd_printpreview", "key_print", "button-print",
                           "mailContext-print", "mailContext-printpreview"];

    overrideAttribute( printElementIds, "oncommand",
                       "Smaug.msg.msgPrint('", "');");

    Smaug.msg.overrideLayoutChange();

    Smaug.msg.savedHeaders = null;

    Smaug.msg.decryptButton = document.getElementById("button-smaug-decrypt");

    // Need to add event listener to Smaug.msg.messagePane to make it work
    // Adding to msgFrame doesn't seem to work
    Smaug.msg.messagePane.addEventListener("unload", Smaug.msg.messageFrameUnload.bind(Smaug.msg), true);

    // override double clicking attachments, but fall back to existing handler if present
    var attListElem = document.getElementById("attachmentList");
    if (attListElem) {
      var newHandler = "Smaug.msg.smgAttachmentListClick('attachmentList', event)";
      var oldHandler = attListElem.getAttribute("onclick");
      if (oldHandler)
        newHandler = "if (!" + newHandler + ") {" + oldHandler + "}";
      attListElem.setAttribute("onclick", newHandler);
    }

    var treeController = {
      supportsCommand: function(command) {
        // SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: treeCtrl: supportsCommand: "+command+"\n");
        switch(command) {
        case "button_smaug_decrypt":
          return true;
        }
        return false;
      },
      isCommandEnabled: function(command) {
        // SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: treeCtrl: isCommandEnabled: "+command+"\n");
        try {
          if (gFolderDisplay.messageDisplay.visible) {
            if (gFolderDisplay.selectedCount != 1) Smaug.hdrView.statusBarHide();
            return (gFolderDisplay.selectedCount == 1);
          }
          Smaug.hdrView.statusBarHide();
        }
        catch (ex) {}
        return  false;
      },
      doCommand: function(command) {
        //SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: treeCtrl: doCommand: "+command+"\n");
        // nothing
      },
      onEvent: function(event) {
        // SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: treeCtrl: onEvent: "+command+"\n");
        // nothing
      }
    };

    top.controllers.appendController(treeController);

    SmaugCommon.initPrefService();
    if (SmaugCommon.getPref("configuredVersion") == "") {
      SmaugCommon.setPref("configuredVersion", SmaugCommon.getVersion());
      SmaugFuncs.openSetupWizard(window);
    }
  },

  viewSecurityInfo: function (event, displaySmimeMsg)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: viewSecurityInfo\n");

    if (event && event.button != 0)
      return;

    if (gSignatureStatus >= 0 || gEncryptionStatus >= 0) {
      showMessageReadSecurityInfo();
    }
    else {
      if (Smaug.msg.securityInfo)
        this.viewOpenpgpInfo();
      else
        showMessageReadSecurityInfo();
    }
  },

  viewOpenpgpInfo: function ()
  {
    if (Smaug.msg.securityInfo) {
      SmaugCommon.longAlert(window, SmaugCommon.getString("securityInfo")+Smaug.msg.securityInfo.statusInfo);
    }
  },


  messageReload: function (noShowReload)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: this.messageReload: "+noShowReload+"\n");

    Smaug.msg.noShowReload = noShowReload;

    ReloadMessage();
  },


  reloadCompleteMsg: function ()
  {
    gDBView.reloadMessageWithAllParts();
  },


  setAttachmentReveal: function (attachmentList)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: setAttachmentReveal\n");

    var revealBox = document.getElementById("smaugRevealAttachments");
    revealBox.setAttribute("hidden", attachmentList == null ? "true" : "false");
  },


  messageCleanup: function () {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageCleanup\n");

    var smaugBox = document.getElementById("smaugBox");

    if (smaugBox && !smaugBox.collapsed) {
      smaugBox.setAttribute("collapsed", "true");

      var statusText = document.getElementById("expandedSmaugStatusText");

      if (statusText)
        statusText.value="";
    }

    this.setAttachmentReveal(null);

    if (Smaug.msg.createdURIs.length) {
      // Cleanup messages belonging to this window (just in case)
      var smaugSvc = Smaug.getSmaugSvc();
      if (smaugSvc) {
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: Cleanup: Deleting messages\n");
        for (var index=0; index < Smaug.msg.createdURIs.length; index++) {
          smaugSvc.deleteMessageURI(Smaug.msg.createdURIs[index]);
        }
        Smaug.msg.createdURIs = [];
      }
    }

    Smaug.msg.decryptedMessage = null;
    Smaug.msg.securityInfo = null;
  },

  messageFrameUnload: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageFrameUnload\n");

    if (Smaug.msg.noShowReload) {
      Smaug.msg.noShowReload = false;

    } else {
      Smaug.msg.savedHeaders = null;

      Smaug.msg.messageCleanup();
    }
  },

  overrideLayoutChange: function ()
  {
    // Smaug needs to listen to some layout changes in order to decrypt
    // messages in case the user changes the layout
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: overrideLayoutChange\n");
    var viewTypeElementIds = ["messagePaneVertical",
                              "messagePaneClassic",
                              "messagePaneWide"];
    var i;
    for (i = 0; i < viewTypeElementIds.length; i++) {
      var elementId = viewTypeElementIds[i];
      var element = document.getElementById(elementId);
      if (element) {
        try {
          var oldValue = element.getAttribute("oncommand").replace(/;/g, "");
          var arg=oldValue.replace(/^(.*)(\(.*\))/, "$2");
          element.setAttribute("oncommand", "Smaug.msg.changeMailLayout"+arg);
        } catch (ex) {}
      }
    }

    var toggleMsgPaneElementIds = ["cmd_toggleMessagePane"];
    for (i = 0; i < toggleMsgPaneElementIds.length; i++) {
      var elementId = toggleMsgPaneElementIds[i];
      var element = document.getElementById(elementId);
      if (element) {
        try {
          element.setAttribute("oncommand", "Smaug.msg.toggleMessagePane()");
        } catch (ex) {}
      }
    }
  },

  changeMailLayout: function (viewType)
  {
    // call the original layout change 1st
    ChangeMailLayout(viewType);

    // This event requires that we re-subscribe to these events!
    Smaug.msg.messagePane.addEventListener("unload", Smaug.msg.messageFrameUnload.bind(Smaug.msg), true);
    this.messageReload(false);
  },

  toggleMessagePane: function () {
    Smaug.hdrView.statusBarHide();
    MsgToggleMessagePane(true);

    var button=document.getElementById("button_smaug_decrypt");
    if (gFolderDisplay.messageDisplay.visible) {
      button.removeAttribute("disabled");
    }
    else {
      button.setAttribute("disabled", "true");
    }
  },

  getCurrentMsgUriSpec: function ()
  {
    try {
      if (gFolderDisplay.selectedMessages.length != 1)
        return "";

      var uriSpec = gFolderDisplay.selectedMessageUris[0];
      //SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: getCurrentMsgUriSpec: uriSpec="+uriSpec+"\n");

      return uriSpec;

    }
    catch (ex) {
      return "";
    }
  },

  getCurrentMsgUrl: function ()
  {
    var uriSpec = this.getCurrentMsgUriSpec();
    return this.getUrlFromUriSpec(uriSpec);
  },

  getUrlFromUriSpec: function (uriSpec)
  {
    try {
      if (!uriSpec)
        return null;

      var msgService = messenger.messageServiceFromURI(uriSpec);

      var urlObj = new Object();
      msgService.GetUrlForUri(uriSpec, urlObj, msgWindow);

      var url = urlObj.value;

      if (url.scheme=="file") {
        return url;
      }
      else {
        return url.QueryInterface(Components.interfaces.nsIMsgMailNewsUrl);
      }

    }
    catch (ex) {
      return null;
    }
  },

  updateOptionsDisplay: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: updateOptionsDisplay: \n");
    var optList = ["autoDecrypt"];

    for (var j=0; j<optList.length; j++) {
      var menuElement = document.getElementById("smaug_"+optList[j]);
      menuElement.setAttribute("checked", SmaugCommon.getPref(optList[j]) ? "true" : "false");

      menuElement = document.getElementById("smaug_"+optList[j]+"2");
      if (menuElement)
        menuElement.setAttribute("checked", SmaugCommon.getPref(optList[j]) ? "true" : "false");
    }

    optList = ["decryptverify", "importpublickey", "savedecrypted"];
    for (j=0; j<optList.length; j++) {
      menuElement = document.getElementById("smaug_"+optList[j]);
      if (Smaug.msg.decryptButton && Smaug.msg.decryptButton.disabled) {
         menuElement.setAttribute("disabled", "true");
      }
      else {
         menuElement.removeAttribute("disabled");
      }

      menuElement = document.getElementById("smaug_"+optList[j]+"2");
      if (menuElement) {
        if (Smaug.msg.decryptButton && Smaug.msg.decryptButton.disabled) {
           menuElement.setAttribute("disabled", "true");
        }
        else {
           menuElement.removeAttribute("disabled");
        }
      }
    }
  },

  displayMainMenu: function(menuPopup) {

    function traverseTree(currentElement, func)
    {
      if (currentElement)
      {
        func(currentElement);
        if (currentElement.id)
          SmaugCommon.DEBUG_LOG("traverseTree: "+currentElement.id+"\n");

        // Traverse the tree
        var i=0;
        var currentElementChild=currentElement.childNodes[i];
        while (currentElementChild)
        {
          // Recursively traverse the tree structure of the child node
          traverseTree(currentElementChild, func);
          i++;
          currentElementChild=currentElement.childNodes[i];
        }
      }
    }

    var p = menuPopup.parentNode;
    var a = document.getElementById("menu_SmaugPopup");
    var c = a.cloneNode(true);
    p.removeChild(menuPopup);


    traverseTree(c, function _updNode(node) {
       if (node.id && node.id.length > 0) node.id += "2";
    });
    p.appendChild(c);

  },

  toggleAttribute: function (attrName)
  {
    SmaugCommon.DEBUG_LOG("smaugMsgessengerOverlay.js: toggleAttribute('"+attrName+"')\n");

    var menuElement = document.getElementById("smaug_"+attrName);

    var oldValue = SmaugCommon.getPref(attrName);
    SmaugCommon.setPref(attrName, !oldValue);

    this.updateOptionsDisplay();

    if (attrName == "autoDecrypt")
      this.messageReload(false);
  },

  messageImport: function (event)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageImport: "+event+"\n");

    return this.messageParse(!event, true, "", this.getCurrentMsgUriSpec());
  },

  // callback function for automatic decryption
  messageAutoDecrypt: function (event)
  {
    Smaug.msg.messageDecrypt(event, true);
  },

  // analyse message header and decrypt/verify message
  messageDecrypt: function (event, isAuto)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageDecrypt: "+event+"\n");

    var cbObj = {
      event: event,
      isAuto: isAuto
    };

    let contentType = "text/plain";
    if ('content-type' in currentHeaderData) contentType=currentHeaderData['content-type'].headerValue;


    // don't parse message if we know it's a PGP/MIME message
    if (((contentType.search(/^multipart\/signed(;|$)/i) == 0) && (contentType.search(/application\/pgp-signature/i)>0)) ||
      ((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) && (contentType.search(/application\/pgp-encrypted/i)>0))) {
      this.messageDecryptCb(event, isAuto, null);
      return;
    }

    try {
      if (gFolderDisplay.selectedMessageIsNews) throw "dummy"; // workaround for broken NNTP support in Gloda
      MsgHdrToMimeMessage(gFolderDisplay.selectedMessage , cbObj, Smaug.msg.msgDecryptMimeCb, true, {examineEncryptedParts: true, partsOnDemand: false});
    }
    catch (ex) {
      SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: smgMessageDecrypt: cannot use MsgHdrToMimeMessage\n");
      this.messageDecryptCb(event, isAuto, null);
    }
  },


  msgDecryptMimeCb: function (msg, mimeMsg)
  {
    // MsgHdrToMimeMessage is not on the main thread which may lead to problems with
    // accessing DOM and debugging

    SmaugCommon.dispatchEvent(
      function(argList) {
        var smaugSvc=Smaug.getSmaugSvc();
        if (!smaugSvc) return;

        var event = argList[0];
        var isAuto = argList[1];
        var mimeMsg = argList[2];
        Smaug.msg.messageDecryptCb(event, isAuto, mimeMsg);
      }, 0, [this.event, this.isAuto, mimeMsg]);
  },

  enumerateMimeParts: function (mimePart, resultObj)
  {
    SmaugCommon.DEBUG_LOG("enumerateMimeParts: partName=\""+mimePart.partName+"\"\n");
    SmaugCommon.DEBUG_LOG("                    "+mimePart.headers["content-type"]+"\n");
    SmaugCommon.DEBUG_LOG("                    "+mimePart+"\n");
    if (mimePart.parts) {
      SmaugCommon.DEBUG_LOG("                    "+mimePart.parts.length+" subparts\n");
    }
    else {
      SmaugCommon.DEBUG_LOG("                    0 subparts\n");
    }

    try {
      if (typeof(mimePart.contentType) == "string" &&
          mimePart.contentType == "multipart/fake-container") {
        // workaround for wrong content type of signed message
        let signedPart = mimePart.parts[1];
        if (typeof(signedPart.headers["content-type"][0]) == "string") {
          if (signedPart.headers["content-type"][0].search(/application\/pgp-signature/i) >= 0) {
            resultObj.signed=signedPart.partName.replace(/\.[0-9]+$/, "");
            SmaugCommon.DEBUG_LOG("enumerateMimeParts: found signed subpart "+resultObj.signed + "\n");
          }
        }
      }

      var ct = mimePart.headers["content-type"][0];
      if (typeof(ct) == "string") {
        ct = ct.replace(/[\r\n]/g, " ");
        if (ct.search(/multipart\/signed.*application\/pgp-signature/i) >= 0) {
          resultObj.signed=mimePart.partName;
        }
        else if (ct.search(/application\/pgp-encrypted/i) >= 0)
          resultObj.encrypted=mimePart.partName;
      }
    }
    catch (ex) {
      // catch exception if no headers or no content-type defined.
    }

    var i;
    for (i in mimePart.parts) {
      this.enumerateMimeParts(mimePart.parts[i], resultObj);
    }
  },


  messageDecryptCb: function (event, isAuto, mimeMsg)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageDecryptCb:\n");

    buggyExchangeEmailContent = null; // reinit HACK for MS-EXCHANGE-Server Problem

    var smaugSvc;
    try {
      var showHeaders = 0;
      var contentType = "";

      if (mimeMsg == null) {
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageDecryptCb: mimeMsg is null\n");
        try {
          contentType=currentHeaderData['content-type'].headerValue;
        }
        catch (ex) {
          contentType = "text/plain";
        }
        mimeMsg = {
          headers: {'content-type': contentType },
          contentType: contentType,
          parts: null
        };
      }

      // Copy selected headers
      Smaug.msg.savedHeaders = {};

      for (var index=0; index < Smaug.msg.headersList.length; index++) {
        var headerName = Smaug.msg.headersList[index];
        var headerValue = "";

        if (mimeMsg.headers[headerName] != undefined) {
          headerValue = mimeMsg.headers[headerName].toString();
        }

        Smaug.msg.savedHeaders[headerName] = headerValue;
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: header "+headerName+": "+headerValue+"\n");
      }

      var embeddedSigned = null;
      var embeddedEncrypted = null;

      if (mimeMsg.parts != null && Smaug.msg.savedHeaders["content-type"].search(/^multipart\/encrypted(;|$)/i) != 0) {
        // TB >= 8.0
        var resultObj={ encrypted: "", signed: "" };
        this.enumerateMimeParts(mimeMsg, resultObj);
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: embedded objects: "+resultObj.encrypted+" / "+resultObj.signed+"\n");

        // HACK for MS-EXCHANGE-Server Problem:
        // check for possible bad mime structure due to buggy exchange server:
        // - multipart/mixed Container with
        //   - application/pgp-encrypted Attachment with name "PGPMIME Versions Identification"
        //   - application/octet-stream Attachment with name "encrypted.asc" having the encrypted content in base64
        // - see:
        //   - http://www.mozilla-smaug.org/forum/viewtopic.php?f=4&t=425
        //   - http://sourceforge.net/p/smaug/forum/support/thread/4add2b69/

        if (mimeMsg.parts && mimeMsg.parts.length && mimeMsg.parts.length == 1 &&
            mimeMsg.parts[0].parts && mimeMsg.parts[0].parts.length && mimeMsg.parts[0].parts.length == 3 &&
            mimeMsg.parts[0].headers["content-type"][0].indexOf("multipart/mixed") >= 0 &&
            mimeMsg.parts[0].parts[0].size == 0 &&
            mimeMsg.parts[0].parts[0].headers["content-type"][0].search(/multipart\/encrypted/i) < 0 &&
            mimeMsg.parts[0].parts[0].headers["content-type"][0].indexOf("text/plain") >= 0 &&
            mimeMsg.parts[0].parts[1].headers["content-type"][0].indexOf("application/pgp-encrypted") >= 0 &&
            mimeMsg.parts[0].parts[1].headers["content-type"][0].search(/multipart\/encrypted/i) < 0 &&
            mimeMsg.parts[0].parts[1].headers["content-type"][0].indexOf("PGPMIME Versions Identification") >= 0 &&
            mimeMsg.parts[0].parts[2].headers["content-type"][0].indexOf("application/octet-stream") >= 0 &&
            mimeMsg.parts[0].parts[2].headers["content-type"][0].indexOf("encrypted.asc") >= 0) {
          // signal that the structure matches to save the content later on
          SmaugCommon.DEBUG_LOG("smaugMessengerOverlay: messageDecryptCb: enabling MS-Exchange hack\n");
          buggyExchangeEmailContent = "???";
        }

        // ignore mime parts on top level (regular messages)
        if (resultObj.signed.indexOf(".") < 0) resultObj.signed = null;
        if (resultObj.encrypted.indexOf(".") < 0) resultObj.encrypted = null;

        if (resultObj.encrypted || resultObj.signed) {
          let mailUrl = this.getCurrentMsgUrl();
          if (mailUrl) {
            if (resultObj.signed) embeddedSigned = mailUrl.spec+"?part="+resultObj.signed.replace(/\.\d+$/, "");
            if (resultObj.encrypted) embeddedEncrypted = mailUrl.spec+"?part="+resultObj.encrypted.replace(/\.\d+$/, "");
          }
        }
      }

      var contentEncoding = "";
      var xSmaugVersion = "";
      var msgUriSpec = this.getCurrentMsgUriSpec();

      if (Smaug.msg.savedHeaders) {
        contentType      = Smaug.msg.savedHeaders["content-type"];
        contentEncoding  = Smaug.msg.savedHeaders["content-transfer-encoding"];
        xSmaugVersion = Smaug.msg.savedHeaders["x-smaug-version"];
      }

      if (isAuto && (! SmaugCommon.getPref("autoDecrypt"))) {
        var signedMsg = ((contentType.search(/^multipart\/signed(;|$)/i) == 0) && (contentType.search(/application\/pgp-signature/i)>0));
        var encrypedMsg = ((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) && (contentType.search(/application\/pgp-encrypted/i)>0));
        if (embeddedSigned || embeddedEncrypted ||
            encrypedMsg || signedMsg) {
          smaugSvc = Smaug.getSmaugSvc();
          if (!smaugSvc)
            return;

          if (signedMsg ||
              ((!encrypedMsg) && (embeddedSigned || embeddedEncrypted))) {
            Smaug.hdrView.updateHdrIcons(SmaugCommon.POSSIBLE_PGPMIME, 0, "", "", "", SmaugCommon.getString("possiblyPgpMime"), null);
          }
        }
        return;
      }

      if (contentType.search(/^multipart\/encrypted(;|$)/i) == 0) {
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: multipart/encrypted\n");

        smaugSvc = Smaug.getSmaugSvc();
        if (!smaugSvc)
          return;
      }

      if (((contentType.search(/^multipart\/encrypted(;|$)/i) == 0) ||
          (embeddedEncrypted && contentType.search(/^multipart\/mixed(;|$)/i) == 0))
           && (!embeddedSigned)) {

        smaugSvc = Smaug.getSmaugSvc();
        if (!smaugSvc)
          return;

        if (! isAuto) {
          Smaug.msg.messageReload(false);
        }
        else if (embeddedEncrypted && (! encrypedMsg)) {
          var mailNewsUrl = this.getCurrentMsgUrl();
          if (mailNewsUrl) {
            mailNewsUrl.spec = embeddedEncrypted;
            Smaug.msg.verifyEmbeddedMsg(window, mailNewsUrl, msgWindow, msgUriSpec, contentEncoding, event);
          }
        }

        return;
      }

      var tryVerify = false;
      var enableSubpartTreatment = false;
      // special treatment for embedded signed messages
      if (embeddedSigned) {
        if (contentType.search(/^multipart\/encrypted(;|$)/i) == 0) {
          tryVerify = true;
        }
        if (contentType.search(/^multipart\/mixed(;|$)/i) == 0) {
          tryVerify = true;
          enableSubpartTreatment = true;
        }
      }

      if ((contentType.search(/^multipart\/signed(;|$)/i) == 0) &&
           (contentType.search(/application\/pgp-signature/i) >= 0)) {
        tryVerify=true;
      }
      if (tryVerify) {
        // multipart/signed
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageDecryptCb: multipart/signed\n");

        var mailNewsUrl = this.getCurrentMsgUrl();
        if (mailNewsUrl) {
            SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageDecryptCb: mailNewsUrl:"+mailNewsUrl+"\n");
            SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageDecryptCb: msgUriSpec:"+msgUriSpec+"\n");
          if (embeddedSigned) {
            mailNewsUrl.spec = embeddedSigned;
            Smaug.msg.verifyEmbeddedMsg(window, mailNewsUrl, msgWindow, msgUriSpec, contentEncoding, event);
          }
          else {
            var verifier = SmaugVerify.newVerifier(false, mailNewsUrl, false);
            verifier.startStreaming(window, msgWindow, msgUriSpec);

          }
          return;
        }
      }

      this.messageParse(!event, false, contentEncoding, msgUriSpec);
    }
    catch (ex) {
      SmaugCommon.writeException("smaugMessengerOverlay.js: messageDecryptCb", ex);
    }
  },


  messageParse: function (interactive, importOnly, contentEncoding, msgUriSpec)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParse: "+interactive+"\n");
    var msgFrame = SmaugCommon.getFrame(window, "messagepane");
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: msgFrame="+msgFrame+"\n");

    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: bodyElement="+bodyElement+"\n");

    var findStr = /* interactive ? null : */ "-----BEGIN PGP";
    var msgText = null;
    var foundIndex = -1;

    if (bodyElement.firstChild) {
      let node = bodyElement.firstChild;
      while (node) {
        if (node.nodeName == "DIV") {
          // <EMO>
          foundIndex = 0;
          /*
          foundIndex = node.textContent.indexOf(findStr);

          if (foundIndex >= 0) {
            if (node.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
              foundIndex = -1;
          }
          */
          // </EMO>
          if (foundIndex >= 0) {
            bodyElement = node;
            break;
          }
        }
        node = node.nextSibling;
      }
    }

    if (foundIndex >= 0) {
      msgText = bodyElement.textContent;
    }

    if (!msgText) {
      // No PGP content

      // but this might be caused by the HACK for MS-EXCHANGE-Server Problem
      // - so return only if:
      if (buggyExchangeEmailContent == null || buggyExchangeEmailContent == "???") {
        return;
      }

      SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParse: got buggyExchangeEmailContent = "+ buggyExchangeEmailContent.substr(0, 50) +"\n");
      // fix the whole invalid email by replacing the contents by the decoded text
      // as plain inline format
      msgText = buggyExchangeEmailContent;
      msgText = msgText.replace(/\r\n/g, "\n");
      msgText = msgText.replace(/\r/g,   "\n");

      // content is in encrypted.asc part:
      // <EMO>
      // var idx = msgText.search(/Content-Type: application\/octet\-stream; name=\"encrypted.asc\"/i);
      var idx = msgText.search(/Content-Type: application\/x\-pkcs7\-mime; smime\-type=enveloped\-data; name=\"smime.p7m\"/i);
      // </EMO>
      if (idx >= 0) {
        msgText = msgText.slice(idx);
      }
      // check whether we have base64 encoding
      var isBase64 = false;
      var idx = msgText.search(/Content-Transfer-Encoding: base64/i);
      if (idx >= 0) {
        isBase64 = true;
      }
      // find content behind part header
      var idx = msgText.search(/\n\n/);
      if (idx >= 0) {
        msgText = msgText.slice(idx);
      }
      // remove stuff behind content block (usually a final boundary row)
      var idx = msgText.search(/\n\n--/);
      if (idx >= 0) {
        msgText = msgText.slice(0,idx+1);
      }
      // decrypt base64 if it is encoded that way
      if (isBase64) {
        msgText = msgText.replace(/\n/g,   "");
        //SmaugCommon.DEBUG_LOG("vor base64 decode: \n" + msgText + "\n");
        try {
          msgText = window.atob(msgText);
        } catch (ex) {
          SmaugCommon.writeException("smaugMessengerOverlay.js: calling atob() ", ex);
        }
        //SmaugCommon.DEBUG_LOG("nach base64 decode: \n" + msgText + "\n");
      }
    }

    var charset = msgWindow ? msgWindow.mailCharacterSet : "";

    // Encode ciphertext to charset from unicode
    msgText = SmaugCommon.convertFromUnicode(msgText, charset);

    var mozPlainText = bodyElement.innerHTML.search(/class=\"moz-text-plain\"/);

    if ((mozPlainText >= 0) && (mozPlainText < 40)) {
      // workaround for too much expanded emoticons in plaintext msg
      var r = new RegExp(/( )(;-\)|:-\)|;\)|:\)|:-\(|:\(|:-\\|:-P|:-D|:-\[|:-\*|\>:o|8-\)|:-\$|:-X|\=-O|:-\!|O:-\)|:\'\()( )/g);
      if (msgText.search(r) >= 0) {
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParse: performing emoticons fixing\n");
        msgText = msgText.replace(r, "$2");
      }
    }

    // extract text preceeding and/or following armored block
    var head="";
    var tail="";
    msgText = (null == msgText) ? "" : msgText;
    // <EMO>
    var boundaryIndex = msgText.indexOf("boundary=\"");
    var boundarRegEx = new RegExp(/boundary=\"(.*)\"$/gm);
    var boundaryMarkerResp = boundarRegEx.exec(msgText);
    var boundaryMarker = (null == boundaryMarkerResp) ? "" : boundaryMarkerResp[1];
    var headIdx = msgText.indexOf(boundaryMarker, boundaryIndex + 1);
    var tailIdx = msgText.lastIndexOf(boundaryMarker);
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParse: boundaryMarker='"+boundaryMarker+"' boundarIdx="+boundaryIndex+" headIdx="+headIdx+" tailIdx="+tailIdx+"\n");
    if (findStr) {
      head=msgText.substring(0,msgText.indexOf(findStr)).replace(/^[\n\r\s]*/,"");
      // head=msgText.substring(0,headIdx).replace(/^[\n\r\s]*/,"");
      head=head.replace(/[\n\r\s]*$/,"");
      var endStart=msgText.indexOf("-----END PGP");
      // var endStart=tailIdx;
      var nextLine=msgText.substring(endStart).search(/[\n\r]/);
      if (nextLine>0) {
        tail=msgText.substring(endStart+nextLine).replace(/^[\n\r\s]*/,"");
      }
    }
    // </EMO>

    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: EMO msgText='"+msgText+"'\n");

    var mailNewsUrl = this.getUrlFromUriSpec(msgUriSpec);

    var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";

    let retry = (charset != "UTF-8" ? 1 : 2);

    Smaug.msg.messageParseCallback(msgText, contentEncoding, charset, interactive,
                                      importOnly, urlSpec, "", retry, head, tail,
                                      msgUriSpec);
  },


  messageParseCallback: function (msgText, contentEncoding, charset, interactive,
                                  importOnly, messageUrl, signature, retry,
                                  head, tail, msgUriSpec)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: "+interactive+", "+interactive+", importOnly="+importOnly+", charset="+charset+", msgUrl="+messageUrl+", retry="+retry+", signature='"+signature+"'\n");

    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    if (!msgText)
      return;

    var smaugSvc = Smaug.getSmaugSvc();
    if (!smaugSvc)
      return;

    var plainText;
    var exitCode;
    var newSignature = "";
    var statusFlags = 0;

    var errorMsgObj = new Object();
    var keyIdObj    = new Object();
    var blockSeparationObj = { value: "" };


    if (importOnly) {
      // Import public key
      var importFlags = nsIEnigmail.UI_INTERACTIVE;
      exitCode = smaugSvc.importKey(window, importFlags, msgText, "",
                                       errorMsgObj);

    }
    else {

      if (msgText.indexOf("\nCharset:") > 0) {
        // Check if character set needs to be overridden
        var startOffset = msgText.indexOf("-----BEGIN PGP ");

        if (startOffset >= 0) {
          var subText = msgText.substr(startOffset);

          subText = subText.replace(/\r\n/g, "\n");
          subText = subText.replace(/\r/g,   "\n");

          var endOffset = subText.search(/\n\n/);
          if (endOffset > 0) {
            subText = subText.substr(0,endOffset) + "\n";

            var matches = subText.match(/\nCharset: *(.*) *\n/i);
            if (matches && (matches.length > 1)) {
              // Override character set
              charset = matches[1];
              SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: OVERRIDING charset="+charset+"\n");
            }
          }
        }
      }

      var exitCodeObj    = new Object();
      var statusFlagsObj = new Object();
      var userIdObj      = new Object();
      var sigDetailsObj  = new Object();

      var signatureObj = new Object();
      signatureObj.value = signature;

      var uiFlags = interactive ? (nsIEnigmail.UI_INTERACTIVE |
                                   nsIEnigmail.UI_ALLOW_KEY_IMPORT |
                                   nsIEnigmail.UI_UNVERIFIED_ENC_OK) : 0;


      // <EMO>
      /*
      plainText = smaugSvc.decryptMessage(window, uiFlags, msgText,
                                   signatureObj, exitCodeObj, statusFlagsObj,
                                   keyIdObj, userIdObj, sigDetailsObj, errorMsgObj, blockSeparationObj);
      */
      msgText = msgText.replace(/^[\r\n]+/g, "");
      msgText = msgText.replace(/[\r\n]+$/g, "");
      // SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: from="+currentHeaderData["from"].headerValue+" stripped="+SmgStripEmail(currentHeaderData["from"].headerValue)+"\n");
      plainText = smaugSvc.smgDecryptMessage(window, 
                                             statusFlagsObj,
                                             SmgStripEmail(currentHeaderData["from"].headerValue), 
                                             msgText, 
                                             exitCodeObj, 
                                             errorMsgObj);

      plainText = (null == plainText) ? "" : plainText;
      var boundaryIndex = plainText.indexOf("boundary=\"");
      var boundarRegEx = new RegExp(/boundary=\"(.*)\"$/gm);
      var boundaryMarkerRes = boundarRegEx.exec(plainText);
      var boundaryMarker = (null == boundaryMarkerRes) ? "" : boundaryMarkerRes[1];
      var headIdx = plainText.indexOf(boundaryMarker, boundaryIndex + boundaryMarker.length);
      headIdx += boundaryMarker.length;
      var tailIdx = plainText.indexOf(boundaryMarker, headIdx);
      plainText = plainText.substring(headIdx, tailIdx)
      SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: boundaryMarker = '"+boundaryMarker+"'\n");
      SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: boundaryIdx, headIdx, tailIdx = "+boundaryIndex+", "+headIdx+", "+tailIdx+"\n");
      // </EMO>

      SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: plainText='"+plainText+"'\n");

      exitCode = exitCodeObj.value;
      newSignature = signatureObj.value;

      if (plainText == "" && exitCode == 0) {
        plainText = " ";
      }

      statusFlags = statusFlagsObj.value;

      SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: newSignature='"+newSignature+"'\n");
    }

    var errorMsg = errorMsgObj.value;

    if (importOnly) {
       if (interactive && errorMsg)
         SmaugCommon.longAlert(window, errorMsg);
       return;
    }

    var displayedUriSpec = Smaug.msg.getCurrentMsgUriSpec();
    if (!msgUriSpec || (displayedUriSpec == msgUriSpec)) {
      Smaug.hdrView.updateHdrIcons(exitCode, statusFlags, keyIdObj.value, userIdObj.value, sigDetailsObj.value, errorMsg, null, null);
    }

    var noSecondTry = nsIEnigmail.GOOD_SIGNATURE |
          nsIEnigmail.EXPIRED_SIGNATURE |
          nsIEnigmail.EXPIRED_KEY_SIGNATURE |
          nsIEnigmail.EXPIRED_KEY |
          nsIEnigmail.REVOKED_KEY |
          nsIEnigmail.NO_PUBKEY |
          nsIEnigmail.NO_SECKEY |
          nsIEnigmail.IMPORTED_KEY |
          nsIEnigmail.MISSING_PASSPHRASE |
          nsIEnigmail.BAD_PASSPHRASE |
          nsIEnigmail.UNKNOWN_ALGO |
          nsIEnigmail.DECRYPTION_OKAY |
          nsIEnigmail.OVERFLOWED;

    if ((exitCode !=0) && (! (statusFlags & noSecondTry))) {
      // Bad signature/armor
      if (retry == 1) {
        msgText = SmaugCommon.convertFromUnicode(msgText, "UTF-8");
        Smaug.msg.messageParseCallback(msgText, contentEncoding, charset,
                                          interactive, importOnly, messageUrl,
                                          signature, retry + 1,
                                          head, tail, msgUriSpec);
        return;
      }
      else if (retry == 2) {
        // <EMO>
        msgText = msgText.replace(/^\s$/g, "");
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: Retry 2\n");
        Smaug.msg.messageParseCallback(msgText, contentEncoding, charset,
                                          interactive, importOnly, messageUrl,
                                          signature, retry + 1,
                                          head, tail, msgUriSpec);
        /*
        // Try to verify signature by accessing raw message text directly
        // (avoid recursion by setting retry parameter to false on callback)
        newSignature = "";
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: HER HERE HERE\n");
        Smaug.msg.msgDirectDecrypt(interactive, importOnly, contentEncoding, charset,
                                      newSignature, 0, head, tail, msgUriSpec,
                                      Smaug.msg.messageParseCallback);
        */
        // </EMO>
        return;
      }
      else if (retry == 3) {
        msgText = SmaugCommon.convertToUnicode(msgText, "UTF-8");
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageParseCallback: Retry 3\n");
        Smaug.msg.messageParseCallback(msgText, contentEncoding, charset, interactive,
                                          importOnly, messageUrl, null, retry + 1,
                                          head, tail, msgUriSpec);
        return;
      }
    }

    if (!plainText) {
       if (interactive && Smaug.msg.securityInfo && Smaug.msg.securityInfo.statusInfo)
         SmaugCommon.longAlert(window, Smaug.msg.securityInfo.statusInfo);
       return;
    }

    if (retry >= 2) {
      plainText = SmaugCommon.convertFromUnicode(SmaugCommon.convertToUnicode(plainText, "UTF-8"), charset);
    }

    if (blockSeparationObj.value.indexOf(" ")>=0) {
      var blocks = blockSeparationObj.value.split(/ /);
      var blockInfo = blocks[0].split(/:/);
      plainText = SmaugCommon.convertFromUnicode(SmaugCommon.getString("notePartEncrypted"), charset)
          + "\n\n" + plainText.substr(0, blockInfo[1]) + "\n\n" + SmaugCommon.getString("noteCutMessage");
    }

    // Save decrypted message status, headers, and content
    var headerList = {"subject":"", "from":"", "date":"", "to":"", "cc":""};

    var index, headerName;

    if (!gViewAllHeaders) {
      for (index = 0; index < headerList.length; index++) {
        headerList[index] = "";
      }

    } else {
      for (index = 0; index < gExpandedHeaderList.length; index++) {
        headerList[gExpandedHeaderList[index].name] = "";
      }

      for (headerName in currentHeaderData) {
        headerList[headerName] = "";
      }
    }

    for (headerName in headerList) {
      if (currentHeaderData[headerName])
        headerList[headerName] = currentHeaderData[headerName].headerValue;
    }

    // WORKAROUND
    if (headerList["cc"] == headerList["to"])
      headerList["cc"] = "";

    var hasAttachments = currentAttachments && currentAttachments.length;
    var attachmentsEncrypted=true;

    for (index in currentAttachments) {
      if (! Smaug.msg.checkEncryptedAttach(currentAttachments[index])) {
        if (!Smaug.msg.checkSignedAttachment(currentAttachments, index)) attachmentsEncrypted=false;
      }
    }

    var msgRfc822Text = "";
    if (head || tail) {
      if (head) {
        // print a warning if the signed or encrypted part doesn't start
        // quite early in the message
        matches=head.match(/(\n)/g);
        if (matches && matches.length >10) {
          msgRfc822Text=SmaugCommon.convertFromUnicode(SmaugCommon.getString("notePartEncrypted"), charset)+"\n\n";
        }
        msgRfc822Text+=head+"\n\n";
      }
      msgRfc822Text += SmaugCommon.convertFromUnicode(SmaugCommon.getString("beginPgpPart"), charset)+"\n\n";
    }
    msgRfc822Text+=plainText;
    if (head || tail) {
      msgRfc822Text+="\n\n"+ SmaugCommon.convertFromUnicode(SmaugCommon.getString("endPgpPart"), charset)+"\n\n"+tail;
    }

    Smaug.msg.decryptedMessage = {url:messageUrl,
                             uri:msgUriSpec,
                             headerList:headerList,
                             hasAttachments:hasAttachments,
                             attachmentsEncrypted:attachmentsEncrypted,
                             charset:charset,
                             plainText:msgRfc822Text};

    var msgFrame = SmaugCommon.getFrame(window, "messagepane");
    var bodyElement = msgFrame.document.getElementsByTagName("body")[0];

    // don't display decrypted message if message selection has changed
    displayedUriSpec = Smaug.msg.getCurrentMsgUriSpec();
    if (msgUriSpec && displayedUriSpec && (displayedUriSpec != msgUriSpec)) return;


    // Create and load one-time message URI
    var messageContent = Smaug.msg.getDecryptedMessage("message/rfc822", false);

    Smaug.msg.noShowReload = true;

    bodyElement = msgFrame.document.getElementsByTagName("body")[0];
    if (bodyElement.firstChild) {
      var node = bodyElement.firstChild;
      var foundIndex = -1;
      var findStr = "-----BEGIN PGP";

      while (node) {
        if (node.nodeName == "DIV") {
          // <EMO>
          // foundIndex = node.textContent.indexOf(findStr);
          foundIndex = 0;
          // </EMO>

          if (foundIndex >= 0) {
            if (node.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
              foundIndex = -1;
          }
          if (foundIndex >= 0) {
            node.innerHTML = SmaugFuncs.formatPlaintextMsg(SmaugCommon.convertToUnicode(messageContent, charset));
            return;
          }
        }
        node = node.nextSibling;
      }

      // if no <DIV> node is found, try with <PRE> (bug 24762)
      node = bodyElement.firstChild;
      foundIndex = -1;
      while (node) {
        if (node.nodeName == "PRE") {
          // <EMO>
          // foundIndex = node.textContent.indexOf(findStr);
          foundIndex = 0;
          // </EMO>

          if (foundIndex >= 0) {
            if (node.textContent.indexOf(findStr+" LICENSE AUTHORIZATION") == foundIndex)
              foundIndex = -1;
          }
          if (foundIndex >= 0) {
            node.innerHTML = SmaugFuncs.formatPlaintextMsg(SmaugCommon.convertToUnicode(messageContent, charset));
            return;
          }
        }
        node = node.nextSibling;
      }

      // HACK for MS-EXCHANGE-Server Problem:
      // - remove empty text/plain part
      //   and set message content as inner text
      // - missing:
      //   - signal in statusFlags so that we warn in Smaug.hdrView.updateHdrIcons()
      if (buggyExchangeEmailContent != null) {
        messageContent = messageContent.replace(/^\s{0,2}Content-Transfer-Encoding: quoted-printable\s*Content-Type: text\/plain;\s*charset=windows-1252/i, "");
        var node = bodyElement.firstChild;
        while (node) {
          if (node.nodeName == "DIV") {
            node.innerHTML = SmaugFuncs.formatPlaintextMsg(SmaugCommon.convertToUnicode(messageContent, charset));
            Smaug.hdrView.updateHdrIcons(exitCode, statusFlags, keyIdObj.value, userIdObj.value, sigDetailsObj.value, errorMsg, null, "buggyMailFormat" );
            return;
          }
          node = node.nextSibling;
        }
      }

    }

    SmaugCommon.ERROR_LOG("smaugMessengerOverlay.js: no node found to replace message display\n");

    return;
  },


  // check if an attachment could be signed
  checkSignedAttachment: function (attachmentObj, index)
  {
    var attachmentList;
    if (index != null) {
      attachmentList = attachmentObj;
    }
    else {
      attachmentList=currentAttachments;
      for (var i=0; i < attachmentList.length; i++) {
        if (attachmentList[i].url == attachmentObj.url) {
          index = i;
          break;
        }
      }
      if (index == null) return false;
    }

    var signed = false;
    var findFile;

    var attName = this.getAttachmentName(attachmentList[index]).toLowerCase().replace(/\+/g, "\\+");

    // check if filename is a signature
    if ((this.getAttachmentName(attachmentList[index]).search(/\.(sig|asc)$/i) > 0) ||
       (attachmentList[index].contentType.match(/^application\/pgp\-signature/i))) {
      findFile = new RegExp(attName.replace(/\.(sig|asc)$/, ""));
    }
    else
      findFile = new RegExp(attName+".(sig|asc)$");

    var i;
    for (i in attachmentList) {
      if ((i != index) &&
          (this.getAttachmentName(attachmentList[i]).toLowerCase().search(findFile) == 0))
        signed=true;
    }

    return signed;
  },

  // check if the attachment could be encrypted
  // <EMO> TODO
  checkEncryptedAttach: function (attachment)
  {
    return (this.getAttachmentName(attachment).match(/\.(gpg|pgp|asc)$/i) ||
      (attachment.contentType.match(/^application\/pgp(\-.*)?$/i)) &&
       (attachment.contentType.search(/^application\/pgp\-signature/i) < 0));
  },

  getAttachmentName: function (attachment) {
    if (typeof(attachment.displayName) == "undefined") {
      // TB >=  7.0
      return attachment.name;
    }
    else
      // TB <= 6.0
      return attachment.displayName;
  },

  escapeTextForHTML: function (text, hyperlink)
  {
    // Escape special characters
    if (text.indexOf("&") > -1)
      text = text.replace(/&/g, "&amp;");

    if (text.indexOf("<") > -1)
      text = text.replace(/</g, "&lt;");

    if (text.indexOf(">") > -1)
      text = text.replace(/>/g, "&gt;");

    if (text.indexOf("\"") > -1)
      text = text.replace(/"/g, "&quot;");

    if (!hyperlink)
      return text;

    // Hyperlink email addresses
    var addrs = text.match(/\b[A-Za-z0-9_+\-\.]+@[A-Za-z0-9\-\.]+\b/g);

    var newText, offset, loc;
    if (addrs && addrs.length) {
      newText = "";
      offset = 0;

      for (var j=0; j < addrs.length; j++) {
        var addr = addrs[j];

        loc = text.indexOf(addr, offset);
        if (loc < offset)
          break;

        if (loc > offset)
          newText += text.substr(offset, loc-offset);

        // Strip any period off the end of address
        addr = addr.replace(/[\.]$/, "");

        if (!addr.length)
          continue;

        newText += "<a href=\"mailto:"+addr+"\">" + addr + "</a>";

        offset = loc + addr.length;
      }

      newText += text.substr(offset, text.length-offset);

      text = newText;
    }

    // Hyperlink URLs
    var urls = text.match(/\b(http|https|ftp):\S+\s/g);

    if (urls && urls.length) {
      newText = "";
      offset = 0;

      for (var k=0; k < urls.length; k++) {
        var url = urls[k];

        loc = text.indexOf(url, offset);
        if (loc < offset)
          break;

        if (loc > offset)
          newText += text.substr(offset, loc-offset);

        // Strip delimiters off the end of URL
        url = url.replace(/\s$/, "");
        url = url.replace(/([\),\.']|&gt;|&quot;)$/, "");

        if (!url.length)
          continue;

        newText += "<a href=\""+url+"\">" + url + "</a>";

        offset = loc + url.length;
      }

      newText += text.substr(offset, text.length-offset);

      text = newText;
    }

    return text;
  },

  getDecryptedMessage: function (contentType, includeHeaders)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: getDecryptedMessage: "+contentType+", "+includeHeaders+"\n");

    if (!Smaug.msg.decryptedMessage)
      return "No decrypted message found!\n";

    var smaugSvc = Smaug.getSmaugSvc();
    if (!smaugSvc)
      return "";

    var headerList = Smaug.msg.decryptedMessage.headerList;

    var statusLine = Smaug.msg.securityInfo ? Smaug.msg.securityInfo.statusLine : "";

    var contentData = "";

    var headerName;

    if (contentType == "message/rfc822") {
      // message/rfc822

      if (includeHeaders) {
        try {

          var msg = gFolderDisplay.selectedMessage;
          if (msg) {
            msgHdr = { "From": msg.author,
                       "Subject": msg.subject,
                       "To": msg.recipients,
                       "Cc": msg.ccList,
                       "Date": SmaugCommon.getDateTime(msg.dateInSeconds, true, true) };


            if(gFolderDisplay.selectedMessageIsNews) {
              if (typeof (currentHeaderData.newsgroups)) {
                msgHdr.Newsgroups = currentHeaderData.newsgroups.headerValue;
              }
            }

            for (headerName in msgHdr) {
              if (msgHdr[headerName] && msgHdr[headerName].length>0)
                contentData += headerName + ": " + msgHdr[headerName] + "\r\n";
            }

          }
        } catch (ex) {
          // the above seems to fail every now and then
          // so, here is the fallback
          for (headerName in headerList) {
            headerValue = headerList[headerName];
            contentData += headerName + ": " + headerValue + "\r\n";
          }
        }

        contentData += "Content-Type: text/plain";

        if (Smaug.msg.decryptedMessage.charset) {
          contentData += "; charset="+Smaug.msg.decryptedMessage.charset;
        }

        contentData += "\r\n";
      }

      contentData += "\r\n";

      if (Smaug.msg.decryptedMessage.hasAttachments && (! Smaug.msg.decryptedMessage.attachmentsEncrypted)) {
        contentData += SmaugCommon.convertFromUnicode(SmaugCommon.getString("smgContentNote"), Smaug.msg.decryptedMessage.charset);
      }

      contentData += Smaug.msg.decryptedMessage.plainText;

    } else {
      // text/html or text/plain

      if (contentType == "text/html") {
        contentData += "<meta http-equiv=\"Content-Type\" content=\"text/html; charset="+Smaug.msg.decryptedMessage.charset+"\">\r\n";

        contentData += "<html><head></head><body>\r\n";
      }

      if (statusLine) {
        if (contentType == "text/html") {
          contentData += "<b>"+SmaugCommon.getString("smgHeader")+"</b> " +
                         this.escapeTextForHTML(statusLine, false) + "<br>\r\n<hr>\r\n";
        } else{
          contentData += SmaugCommon.getString("smgHeader")+" " + statusLine + "\r\n\r\n";
        }
      }

      if (includeHeaders) {
        for (headerName in headerList) {
          headerValue = headerList[headerName];

          if (headerValue) {
            if (contentType == "text/html") {
              contentData += "<b>"+this.escapeTextForHTML(headerName, false)+":</b> "+
                                   this.escapeTextForHTML(headerValue, false)+"<br>\r\n";
            } else {
              contentData += headerName + ": " + headerValue + "\r\n";
            }
          }
        }
      }

      if (contentType == "text/html") {
        contentData += "<pre>"+this.escapeTextForHTML(Smaug.msg.decryptedMessage.plainText, false)+"</pre>\r\n";

        contentData += "</body></html>\r\n";

      } else {

        contentData += "\r\n"+Smaug.msg.decryptedMessage.plainText;
      }

      if (!(SmaugCommon.isDosLike())) {
        contentData = contentData.replace(/\r\n/g, "\n");
      }
    }

    return contentData;
  },


  msgDefaultPrint: function (elementId)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: this.msgDefaultPrint: "+elementId+"\n");

    goDoCommand(elementId.indexOf("printpreview")>=0 ? "cmd_printpreview" : "cmd_print");
  },

  msgPrint: function (elementId)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: msgPrint: "+elementId+"\n");

    var contextMenu = (elementId.search("Context") > -1);

    if (!Smaug.msg.decryptedMessage || typeof(Smaug.msg.decryptedMessage) == "undefined") {
      this.msgDefaultPrint(elementId);
      return;
    }

    var mailNewsUrl = this.getCurrentMsgUrl();

    if (!mailNewsUrl) {
      this.msgDefaultPrint(elementId);
      return;
    }

    if (Smaug.msg.decryptedMessage.url != mailNewsUrl.spec) {
      Smaug.msg.decryptedMessage = null;
      this.msgDefaultPrint(elementId);
      return;
    }

    var smaugSvc = Smaug.getSmaugSvc();
    if (!smaugSvc) {
      this.msgDefaultPrint(elementId);
      return;
    }

    // Note: Trying to print text/html content does not seem to work with
    //       non-ASCII chars
    var msgContent = this.getDecryptedMessage("message/rfc822", true);

    var uri = smaugSvc.createMessageURI(Smaug.msg.decryptedMessage.url,
                                           "message/rfc822",
                                           "",
                                           msgContent,
                                           false);

    Smaug.msg.createdURIs.push(uri);

    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: msgPrint: uri="+uri+"\n");

    var messageList = [uri];

    var printPreview = (elementId.indexOf("printpreview")>=0);

    window.openDialog("chrome://messenger/content/msgPrintEngine.xul",
                      "",
                      "chrome,dialog=no,all,centerscreen",
                      1, messageList, statusFeedback,
                      printPreview, Components.interfaces.nsIMsgPrintEngine.MNAB_PRINTPREVIEW_MSG,
                      window);

    return true;
  },

  messageSave: function ()
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageSave: \n");

    if (!Smaug.msg.decryptedMessage) {
      SmaugCommon.alert(window, SmaugCommon.getString("noDecrypted"));
      return;
    }

    var mailNewsUrl = this.getCurrentMsgUrl();

    if (!mailNewsUrl) {
      SmaugCommon.alert(window, SmaugCommon.getString("noMessage"));
      return;
    }

    if (Smaug.msg.decryptedMessage.url != mailNewsUrl.spec) {
      Smaug.msg.decryptedMessage = null;
      SmaugCommon.alert(window, SmaugCommon.getString("useButton"));
      return;
    }

    var saveFile = SmaugCommon.filePicker(window, SmaugCommon.getString("saveHeader"),
                                  Smaug.msg.lastSaveDir, true, "txt",
                                  null, ["Text files", "*.txt"]);
    if (!saveFile) return;

    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: messageSave: path="+saveFile.path+"\n");

    if (saveFile.parent)
      Smaug.msg.lastSaveDir = SmaugCommon.getFilePath(saveFile.parent);

    var textContent = this.getDecryptedMessage("text/plain", true);

    if (!Smaug.msg.writeFileContents(saveFile.path, textContent, null)) {
      SmaugCommon.alert(window, "Error in saving to file "+saveFile.path);
      return;
    }

    return;
  },

  msgDirectDecrypt: function (interactive, importOnly, contentEncoding, charset, signature,
                           bufferSize, head, tail, msgUriSpec, callbackFunction)
  {
    SmaugCommon.WRITE_LOG("smaugMessengerOverlay.js: msgDirectDecrypt: contentEncoding="+contentEncoding+", signature="+signature+"\n");
    var mailNewsUrl = this.getCurrentMsgUrl();
    if (!mailNewsUrl)
      return;

    var callbackArg = { interactive:interactive,
                        importOnly:importOnly,
                        contentEncoding:contentEncoding,
                        charset:charset,
                        messageUrl:mailNewsUrl.spec,
                        msgUriSpec:msgUriSpec,
                        signature:signature,
                        data: "",
                        head:head,
                        tail:tail,
                        callbackFunction: callbackFunction };

    var msgSvc = messenger.messageServiceFromURI(msgUriSpec);

    var listener = {
      QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIStreamListener]),
      onStartRequest: function() {
        this.data = "";
        this.inStream = Components.classes["@mozilla.org/scriptableinputstream;1"].
          createInstance(Components.interfaces.nsIScriptableInputStream);

      },
      onDataAvailable: function(req, sup, stream, offset, count) {
        this.inStream.init(stream);
        this.data += this.inStream.read(count);
      },
      onStopRequest: function() {
        // <EMO>
        /*
        var start = this.data.indexOf("-----BEGIN PGP");
        var end = this.data.indexOf("-----END PGP");


        var boundaryIndex = this.data.indexOf("boundary=\");
        var boundarRegEx = /boundary=\"(.*)\"$/gm;
        var boundaryMarker = boundarRegEx.exec(this.data);
        var start = this.data.indexOf(boundaryMarker, boundaryIndex + 1);
        var end = this.data.lastIndexOf(boundaryMarker);
        */
        var boundaryIndex = this.data.indexOf("boundary=\"");
        var boundarRegEx = /boundary=\"(.*)\"$/gm;
        var boundaryMarker = boundarRegEx.exec(this.data)[1];
        var start = this.data.indexOf(boundaryMarker, boundaryIndex + boundaryMarker.length);
        var end = this.data.indexOf(boundaryMarker, start + boundaryMarker.length);
        // </EMO>

        if (start >= 0 && end > start) {
          var tStr = this.data.substr(end);
          var n = tStr.indexOf("\n");
          var r = tStr.indexOf("\r");
          var lEnd = -1;
          if (n >= 0 && r >= 0) {
            lEnd = Math.min(r, n);
          }
          else if (r >= 0) {
            lEnd = r;
          }
          else if (n >= 0)
            lEnd = n;

          if (lEnd >= 0) {
            end += lEnd;
          }

          callbackArg.data = this.data.substring(start, end+1);
          SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: data: >"+callbackArg.data+"<\n");
          Smaug.msg.msgDirectCallback(callbackArg);
        }
      }
    };

    msgSvc.streamMessage(msgUriSpec,
                    listener,
                    msgWindow,
                    null,
                    false,
                    null,
                    false);

  },


  msgDirectCallback: function (callbackArg)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: msgDirectCallback: \n");

    var mailNewsUrl = Smaug.msg.getCurrentMsgUrl();
    var urlSpec = mailNewsUrl ? mailNewsUrl.spec : "";
    var newBufferSize = 0;

    var l = urlSpec.length;

    if (urlSpec.substr(0, l) != callbackArg.messageUrl.substr(0, l)) {
      SmaugCommon.ERROR_LOG("smaugMessengerOverlay.js: msgDirectCallback: Message URL mismatch "+mailNewsUrl.spec+" vs. "+callbackArg.messageUrl+"\n");
      return;
    }

    var msgText = callbackArg.data;
    msgText = SmaugCommon.convertFromUnicode(msgText, "UTF-8");

    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: msgDirectCallback: msgText='"+msgText+"'\n");

    var f = function (argList) {
      var msgText = argList[0];
      var cb = argList[1];
      cb.callbackFunction(msgText, cb.contentEncoding,
                           cb.charset,
                           cb.interactive,
                           cb.importOnly,
                           cb.messageUrl,
                           cb.signature,
                           3,
                           cb.head,
                           cb.tail,
                           cb.msgUriSpec);
    };

    SmaugCommon.dispatchEvent(f, 0, [msgText, callbackArg ]);
  },


  verifyEmbeddedMsg: function (window, msgUrl, msgWindow, msgUriSpec, contentEncoding, event)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: verifyEmbeddedMsg: msgUrl"+msgUrl+"\n");

    var callbackArg = { data: "",
                        window: window,
                        msgUrl: msgUrl,
                        msgWindow: msgWindow,
                        msgUriSpec: msgUriSpec,
                        contentEncoding: contentEncoding,
                        event: event };

    var requestCallback = function _cb (data) {
      callbackArg.data = data;
      Smaug.msg.verifyEmbeddedCallback(callbackArg);
    };

    var bufferListener = SmaugCommon.newStringStreamListener(requestCallback);

    var ioServ = Components.classes[SmaugCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);

    var channel = ioServ.newChannelFromURI(msgUrl);

    channel.asyncOpen(bufferListener, msgUrl);
  },

  verifyEmbeddedCallback: function (callbackArg)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: verifyEmbeddedCallback: \n");

    if (callbackArg.data.length > 0) {
      let msigned=callbackArg.data.search(/content\-type:[ \t]*multipart\/signed/i);
      if(msigned >= 0) {

        // Real multipart/signed message; let's try to verify it
        SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: verifyEmbeddedCallback: detected multipart/signed. msigned: "+msigned+"\n");

        let enableSubpartTreatment=(msigned > 0);

        var verifier = SmaugVerify.newVerifier(enableSubpartTreatment, callbackArg.mailNewsUrl, true);
        verifier.verifyData(callbackArg.window, callbackArg.msgWindow, callbackArg.msgUriSpec, callbackArg.data);

        return;
      }
    }

    // HACK for MS-EXCHANGE-Server Problem:
    // - now let's save the mail content for later processing
    if (buggyExchangeEmailContent == "???") {
      buggyExchangeEmailContent = callbackArg.data;
    }

    // try inline PGP
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: verifyEmbeddedCallback: try inline PGP\n");

    Smaug.msg.messageParse(!callbackArg.event, false, callbackArg.contentEncoding, callbackArg.msgUriSpec);
  },


  revealAttachments: function (index)
  {
    if (!index) index = 0;

    if (index < currentAttachments.length) {
      this.handleAttachment("revealName/"+index.toString(), currentAttachments[index]);
    }
  },


  // handle a selected attachment (decrypt & open or save)
  handleAttachmentSel: function (actionType)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: handleAttachmentSel: actionType="+actionType+"\n");
    var selectedAttachments;
    var anAttachment;

    // Thunderbird
    var contextMenu = document.getElementById('attachmentItemContext');

    if (contextMenu) {
      // Thunderbird
      selectedAttachments = contextMenu.attachments;
      anAttachment = selectedAttachments[0];
    }
    else {
      // SeaMonkey
      contextMenu = document.getElementById('attachmentListContext');
      selectedAttachments = document.getElementById('attachmentList').selectedItems;
      anAttachment = selectedAttachments[0].attachment;
    }

    switch (actionType) {
      case "saveAttachment":
      case "openAttachment":
      case "importKey":
      case "revealName":
        this.handleAttachment(actionType, anAttachment);
        break;
      case "verifySig":
        this.verifyDetachedSignature(anAttachment);
        break;
    }
  },

  /**
   * save the original file plus the signature file to disk and then verify the signature
   */
  verifyDetachedSignature: function (anAttachment)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: verifyDetachedSignature: url="+anAttachment.url+"\n");

    var smaugSvc = Smaug.getSmaugSvc();
    if (! smaugSvc) return;

    var origAtt, signatureAtt;

    if ((this.getAttachmentName(anAttachment).search(/\.sig$/i) > 0) ||
        (anAttachment.contentType.search(/^application\/pgp\-signature/i) == 0)) {
      // we have the .sig file; need to know the original file;

      signatureAtt = anAttachment;
      var origName = this.getAttachmentName(anAttachment).replace(/\.sig$/i, "");

      for (let i=0; i < currentAttachments.length; i++) {
        if (origName == this.getAttachmentName(currentAttachments[i])) {
          origAtt = currentAttachments[i];
          break;
        }
      }
    }
    else {
      // we have a supposedly original file; need to know the .sig file;

      origAtt = anAttachment;
      var sigName = this.getAttachmentName(anAttachment)+".sig";

      for (let i=0; i < currentAttachments.length; i++) {
        if (sigName == this.getAttachmentName(currentAttachments[i])) {
          signatureAtt = currentAttachments[i];
          break;
        }
      }
    }

    if (! signatureAtt) {
      SmaugCommon.alert(window, SmaugCommon.getString("attachment.noMatchToSignature", [ this.getAttachmentName(origAtt) ]));
      return;
    }
    if (! origAtt) {
      SmaugCommon.alert(window, SmaugCommon.getString("attachment.noMatchFromSignature", [ this.getAttachmentName(signatureAtt) ]));
      return;
    }

    // open
    var tmpDir = SmaugCommon.getTempDir();
    var outFile1, outFile2;
    outFile1 = Components.classes[SmaugCommon.LOCAL_FILE_CONTRACTID].
      createInstance(SmaugCommon.getLocalFileApi());
    outFile1.initWithPath(tmpDir);
    if (!(outFile1.isDirectory() && outFile1.isWritable())) {
      SmaugCommon.alert(window, SmaugCommon.getString("noTempDir"));
      return;
    }
    outFile1.append(this.getAttachmentName(origAtt));
    outFile1.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
    this.writeUrlToFile(origAtt.url, outFile1);

    outFile2 = Components.classes[SmaugCommon.LOCAL_FILE_CONTRACTID].
      createInstance(SmaugCommon.getLocalFileApi());
    outFile2.initWithPath(tmpDir);
    outFile2.append(this.getAttachmentName(signatureAtt));
    outFile2.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
    this.writeUrlToFile(signatureAtt.url, outFile2);

    var statusFlagsObj = {};
    var errorMsgObj = {};
    var r = smaugSvc.verifyAttachment(window, outFile1, outFile2, statusFlagsObj, errorMsgObj);

    if (r == 0)
      SmaugCommon.alert(window, SmaugCommon.getString("signature.verifiedOK", [ this.getAttachmentName(origAtt) ]) +"\n\n"+ errorMsgObj.value);
    else
      SmaugCommon.alert(window, SmaugCommon.getString("signature.verifyFailed", [ this.getAttachmentName(origAtt) ])+"\n\n"+
        errorMsgObj.value);

    outFile1.remove(false);
    outFile2.remove(false);
  },

  writeUrlToFile: function(srcUrl, outFile) {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: writeUrlToFile: outFile="+outFile.path+"\n");
     var ioServ = Components.classes[SmaugCommon.IOSERVICE_CONTRACTID].
      getService(Components.interfaces.nsIIOService);
    var msgUri = ioServ.newURI(srcUrl, null, null);
    var channel = ioServ.newChannelFromURI(msgUri);
    var istream = channel.open();

    var fstream = Components.classes["@mozilla.org/network/safe-file-output-stream;1"]
                          .createInstance(Components.interfaces.nsIFileOutputStream);
    var buffer  = Components.classes["@mozilla.org/network/buffered-output-stream;1"]
                            .createInstance(Components.interfaces.nsIBufferedOutputStream);
    fstream.init(outFile, 0x04 | 0x08 | 0x20, 0600, 0); // write, create, truncate
    buffer.init(fstream, 8192);

    buffer.writeFrom(istream, istream.available());

    // Close the output streams
    if (buffer instanceof Components.interfaces.nsISafeOutputStream)
      buffer.finish();
    else
      buffer.close();

    if (fstream instanceof Components.interfaces.nsISafeOutputStream)
      fstream.finish();
    else
      fstream.close();

    // Close the input stream
    istream.close();
  },

  handleAttachment: function (actionType, anAttachment)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: handleAttachment: actionType="+actionType+", anAttachment(url)="+anAttachment.url+"\n");

    var argumentsObj = { actionType: actionType,
                         attachment: anAttachment,
                         forceBrowser: false,
                         data: ""
                       };

    var f = function _cb(data) {
      argumentsObj.data = data;
      Smaug.msg.decryptAttachmentCallback([argumentsObj]);
    };

    var bufferListener = SmaugCommon.newStringStreamListener(f);
    var ioServ = Components.classes[SmaugCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
    var msgUri = ioServ.newURI(argumentsObj.attachment.url, null, null);

    var channel = ioServ.newChannelFromURI(msgUri);
    channel.asyncOpen(bufferListener, msgUri);
  },

  setAttachmentName: function (attachment, newLabel, index)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: setAttachmentName ("+newLabel+"):\n");

    var attList=document.getElementById("attachmentList");
    if (attList) {
      var attNode = attList.firstChild;
      while (attNode) {
        // TB <= 9
        if (attNode.getAttribute("attachmentUrl") == attachment.url)
          attNode.setAttribute("label", newLabel);
        // TB >= 10
        if (attNode.getAttribute("name") == attachment.name)
          attNode.setAttribute("name", newLabel);
        attNode=attNode.nextSibling;
      }
    }

    if (typeof(attachment.displayName) == "undefined") {
      attachment.name = newLabel;
    }
    else
      attachment.displayName = newLabel;

    if (index && index.length > 0) {
      this.revealAttachments(parseInt(index)+1);
    }
  },

  decryptAttachmentCallback: function (cbArray)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: decryptAttachmentCallback:\n");

    var callbackArg = cbArray[0];
    const nsIEnigmail = Components.interfaces.nsIEnigmail;

    var exitCodeObj = new Object();
    var statusFlagsObj = new Object();
    var errorMsgObj= new Object();
    var exitStatus = -1;

    var smaugSvc =  Smaug.getSmaugSvc();
    var outFile;
    var origFilename;
    var rawFileName=Smaug.msg.getAttachmentName(callbackArg.attachment).replace(/\.(asc|pgp|gpg)$/i,"");

    if (callbackArg.actionType != "importKey") {
      origFilename = SmaugCommon.getAttachmentFileName(window, callbackArg.data);
      if (origFilename && origFilename.length > rawFileName.length) rawFileName = origFilename;
    }

    if (callbackArg.actionType == "saveAttachment") {
      outFile = SmaugCommon.filePicker(window, SmaugCommon.getString("saveAttachmentHeader"),
                                  Smaug.msg.lastSaveDir, true, "",
                                  rawFileName, null);
      if (! outFile) return;
    }
    else if (callbackArg.actionType.substr(0,10) == "revealName") {
      if (origFilename && origFilename.length > 0) {
        Smaug.msg.setAttachmentName(callbackArg.attachment, origFilename+".pgp", callbackArg.actionType.substr(11,10));
      }
      Smaug.msg.setAttachmentReveal(null);
      return;
    }
    else {
      // open
      var tmpDir = SmaugCommon.getTempDir();
      try {
        outFile = Components.classes[SmaugCommon.LOCAL_FILE_CONTRACTID].createInstance(SmaugCommon.getLocalFileApi());
        outFile.initWithPath(tmpDir);
        if (!(outFile.isDirectory() && outFile.isWritable())) {
          errorMsgObj.value=SmaugCommon.getString("noTempDir");
          return;
        }
        outFile.append(rawFileName);
        outFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
      }
      catch (ex) {
        errorMsgObj.value=SmaugCommon.getString("noTempDir");
        return;
      }
    }

    if (callbackArg.actionType == "importKey") {
      try {
        exitStatus = smaugSvc.importKey(parent, 0, callbackArg.data, "", errorMsgObj);
      }
      catch (ex) {}
      if (exitStatus == 0) {
        SmaugCommon.longAlert(window, SmaugCommon.getString("successKeyImport")+"\n\n"+errorMsgObj.value);
      }
      else {
        SmaugCommon.alert(window, SmaugCommon.getString("failKeyImport")+"\n"+errorMsgObj.value);
      }

      return;
    }

    exitStatus=smaugSvc.decryptAttachment(window, outFile,
                                  Smaug.msg.getAttachmentName(callbackArg.attachment),
                                  callbackArg.data,
                                  exitCodeObj, statusFlagsObj,
                                  errorMsgObj);

    if ((! exitStatus) || exitCodeObj.value != 0) {
      exitStatus=false;
      if ((statusFlagsObj.value & nsIEnigmail.DECRYPTION_OKAY) &&
         (statusFlagsObj.value & nsIEnigmail.UNVERIFIED_SIGNATURE)) {

        if (callbackArg.actionType == "openAttachment") {
          exitStatus = SmaugCommon.confirmDlg(window, SmaugCommon.getString("decryptOkNoSig"), SmaugCommon.getString("msgOvl.button.contAnyway"));
        }
        else {
          SmaugCommon.alert(window, SmaugCommon.getString("decryptOkNoSig"));
        }
      }
      else {
        SmaugCommon.alert(window, SmaugCommon.getString("failedDecrypt")+"\n\n"+errorMsgObj.value);
        exitStatus=false;
      }
    }
    if (exitStatus) {
      if (statusFlagsObj.value & nsIEnigmail.IMPORTED_KEY) {
        SmaugCommon.longAlert(window, SmaugCommon.getString("successKeyImport")+"\n\n"+errorMsgObj.value);
      }
      else if (statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) {
        HandleSelectedAttachments('open');
      }
      else if ((statusFlagsObj.value & nsIEnigmail.DISPLAY_MESSAGE) ||
               (callbackArg.actionType == "openAttachment")) {
        var ioServ = Components.classes[SmaugCommon.IOSERVICE_CONTRACTID].getService(Components.interfaces.nsIIOService);
        var outFileUri = ioServ.newFileURI(outFile);
        var fileExt = outFile.leafName.replace(/(.*\.)(\w+)$/, "$2");
        if (fileExt && ! callbackArg.forceBrowser) {
          var extAppLauncher = Components.classes[SmaugCommon.MIME_CONTRACTID].getService(Components.interfaces.nsPIExternalAppLauncher);
          extAppLauncher.deleteTemporaryFileOnExit(outFile);

          try {
            var mimeService = Components.classes[SmaugCommon.MIME_CONTRACTID].getService(Components.interfaces.nsIMIMEService);
            var fileMimeType = mimeService.getTypeFromFile(outFile);
            var fileMimeInfo = mimeService.getFromTypeAndExtension(fileMimeType, fileExt);

            fileMimeInfo.launchWithFile(outFile);
          }
          catch (ex) {
            // if the attachment file type is unknown, an exception is thrown,
            // so let it be handled by a browser window
            Smaug.msg.loadExternalURL(outFileUri.asciiSpec);
          }
        }
        else {
          // open the attachment using an external application
          Smaug.msg.loadExternalURL(outFileUri.asciiSpec);
        }
      }
    }
  },

  loadExternalURL: function (url) {
    if (SmaugCommon.isSuite()) {
      Smaug.msg.loadURLInNavigatorWindow(url, true);
    }
    else {
      messenger.launchExternalURL(url);
    }
  },

  // retrieves the most recent navigator window (opens one if need be)
  loadURLInNavigatorWindow: function (url, aOpenFlag)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: loadURLInNavigatorWindow: "+url+", "+aOpenFlag+"\n");

    var navWindow;

    // if this is a browser window, just use it
    if ("document" in top) {
      var possibleNavigator = top.document.getElementById("main-window");
      if (possibleNavigator &&
          possibleNavigator.getAttribute("windowtype") == "navigator:browser")
        navWindow = top;
    }

    // if not, get the most recently used browser window
    if (!navWindow) {
      var wm;
      wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(
            Components.interfaces.nsIWindowMediator);
      navWindow = wm.getMostRecentWindow("navigator:browser");
    }

    if (navWindow) {

      if ("loadURI" in navWindow)
        navWindow.loadURI(url);
      else
        navWindow._content.location.href = url;

    } else if (aOpenFlag) {
      // if no browser window available and it's ok to open a new one, do so
      navWindow = window.open(url, "Smaug");
    }

    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: loadURLInNavigatorWindow: navWindow="+navWindow+"\n");

    return navWindow;
  },

  // handle double click events on Attachments
  smgAttachmentListClick: function (elementId, event)
  {
    SmaugCommon.DEBUG_LOG("smaugMessengerOverlay.js: smgAttachmentListClick: event="+event+"\n");

    var attachment=event.target.attachment;
    if (this.checkEncryptedAttach(attachment)) {
      if (event.button == 0 && event.detail == 2) { // double click
        this.handleAttachment("openAttachment", attachment);
        event.stopPropagation();
        return true;
      }
    }
    return false;
  },

  // download keys
  handleUnknownKey: function ()
  {
    var pubKeyId = "0x" + Smaug.msg.securityInfo.keyId.substr(8, 8);

    var mesg =  SmaugCommon.getString("pubKeyNeeded") + SmaugCommon.getString("keyImport", [pubKeyId]);

    if (SmaugCommon.confirmDlg(window, mesg, SmaugCommon.getString("keyMan.button.import"))) {
      var inputObj = {
        searchList : [ pubKeyId ]
      };
      var resultObj = new Object();

      SmaugFuncs.downloadKeys(window, inputObj, resultObj);

      if (resultObj.importedKeys > 0) {
        this.messageReload(false);
      }
    }
  },

  createFileStream: function (filePath, permissions)
  {
    const DEFAULT_FILE_PERMS = 0600;
    const WRONLY             = 0x02;
    const CREATE_FILE        = 0x08;
    const TRUNCATE           = 0x20;

    try {
      var localFile = Components.classes[SmaugCommon.LOCAL_FILE_CONTRACTID].
        createInstance(SmaugCommon.getLocalFileApi());

      localFile.initWithPath(filePath);

      if (localFile.exists()) {

        if (localFile.isDirectory() || !localFile.isWritable())
           throw Components.results.NS_ERROR_FAILURE;

        if (!permissions)
          permissions = localFile.permissions;
      }

      if (!permissions)
        permissions = DEFAULT_FILE_PERMS;

      var flags = WRONLY | CREATE_FILE | TRUNCATE;

      var fileStream = Components.classes["@mozilla.org/network/file-output-stream;1"].
                        createInstance(Components.interfaces.nsIFileOutputStream);

      fileStream.init(localFile, flags, permissions, 0);

      return fileStream;

    } catch (ex) {
      SmaugCommon.ERROR_LOG("smaugMessengerOverlay.js: createFileStream: Failed to create "+filePath+"\n");
      return null;
    }
  },

  writeFileContents: function (filePath, data, permissions)
  {

    try {
      var fileOutStream = this.createFileStream(filePath, permissions);

      if (data.length) {
        if (fileOutStream.write(data, data.length) != data.length)
          throw Components.results.NS_ERROR_FAILURE;

        fileOutStream.flush();
      }
      fileOutStream.close();

    } catch (ex) {
      SmaugCommon.ERROR_LOG("smaugMessengerOverlay.js: writeFileContents: Failed to write to "+filePath+"\n");
      return false;
    }

    return true;
  }
};

window.addEventListener("load",   Smaug.msg.messengerStartup.bind(Smaug.msg), false);

