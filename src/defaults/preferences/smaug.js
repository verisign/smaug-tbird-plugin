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
 * Patrick Brunschwig <patrick@enigmail.net>
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

/**
 * Default pref values for Smaug
 */

// the last configured Smaug version
pref("extensions.smaug.configuredVersion","");

// Hide prefs and menu entries from non-advanced users
pref("extensions.smaug.advancedUser",false);

// additional parameter(s) to pass to GnuPG
pref("extensions.smaug.agentAdditionalParam","");

// path to gpg executable
pref("extensions.smaug.agentPath","");

// enable --always-trust for message sending
pref("extensions.smaug.alwaysTrustSend",true);

// allow empty subject line without asking for confirmation
pref("extensions.smaug.allowEmptySubject",false);

// ** smaug keySel preferences:
// use rules to assign keys
pref("extensions.smaug.assignKeysByRules",true);
// use email addresses to assign keys
pref("extensions.smaug.assignKeysByEmailAddr",true);
// use manual dialog to assign missing keys
pref("extensions.smaug.assignKeysManuallyIfMissing",true);
// always srats manual dialog for keys
pref("extensions.smaug.assignKeysManuallyAlways",false);

// automatically download missing keys from keyserver
pref("extensions.smaug.autoKeyRetrieve","");

// enable automatically decrypt/verify
pref("extensions.smaug.autoDecrypt",true);

// enable X-Smaug-xxx headers
pref("extensions.smaug.addHeaders",false);

// countdown for alerts when composing inline PGP HTML msgs
pref("extensions.smaug.composeHtmlAlertCount",3);

// enable confirm dialog before sending message
pref("extensions.smaug.confirmBeforeSend",false);

// prefer S/MIME or PGP/MIME (0: PGP/MIME, 1: ask, 2: S/MIME)
pref("extensions.smaug.mimePreferPgp",1);

// show warning message when clicking on sign icon
pref("extensions.smaug.displaySignWarn",true);

// display warning as info for partially signed message
pref("extensions.smaug.displayPartiallySigned",true);

// try to match secondary uid to from address
pref("extensions.smaug.displaySecondaryUid",true);

// treat '-- ' as signature separator
pref("extensions.smaug.doubleDashSeparator",true);

// last state of dialog to choose encryption method if there are attachments
pref("extensions.smaug.encryptAttachments",1);

// skip the attachments dialog
pref("extensions.smaug.encryptAttachmentsSkipDlg", 0);

// Encrypt to self
pref("extensions.smaug.encryptToSelf",true);

// enable 'Decrypt & open' for double click on attachment (if possible)
pref("extensions.smaug.handleDoubleClick",true);

// disable '<' and '>' around email addresses
pref("extensions.smaug.hushMailSupport",false);

// display alert for 'failed to initialize smgmime'
pref("extensions.smaug.initAlert",true);

// use -a for encrypting attachments for inline PGP
pref("extensions.smaug.inlineAttachAsciiArmor",false);

// extension to append for inline-encrypted attachments
pref("extensions.smaug.inlineAttachExt",".pgp");

// extension to append for inline-signed attachments
pref("extensions.smaug.inlineSigAttachExt",".sig");

// <EMO>
// debug log directory (if set, also enabled debugging)
pref("extensions.smaug.logDirectory","");

// Where is the S/MIME cert?
pref("extensions.smaug.smaugSmimeCertPath", "");
// </EMO>

// display all or no keys by default in the key manager
pref("extensions.smaug.keyManShowAllKeys",true);


// list of keyservers to use
pref("extensions.smaug.keyserver","pool.sks-keyservers.net, keys.gnupg.net, pgp.mit.edu");

// keep passphrase for ... minutes
pref("extensions.smaug.maxIdleMinutes",5);

// GnuPG hash algorithm
// 0: automatic seletion (i.e. let GnuPG choose)
// 1: SHA1, 2: RIPEMD160, 3: SHA256, 4: SHA384, 5: SHA512, 6: SHA224
pref("extensions.smaug.mimeHashAlgorithm",0);

// no passphrase for GnuPG key needed
pref("extensions.smaug.noPassphrase",false);

// parse all mime headers (do NOT change)
pref("extensions.smaug.parseAllHeaders",true);

// show quoted printable warning message (and remember selected state)
pref("extensions.smaug.quotedPrintableWarn",0);

// use http proxy settings as set in Mozilla/Thunderbird
pref("extensions.smaug.respectHttpProxy",true);

// selection for which encryption model to prefer
// 0: convenient encryption settings DEFAULT
// 1: manual encryption settings
pref("extensions.smaug.encryptionModel",0);

// enable encryption for replies to encrypted mails
pref("extensions.smaug.keepSettingsForReply",true);

// selection for which keys to accept
// 0: accept valid/authenticated keys
// 1: accept all keys (except disabled, ...) DEFAULT
pref("extensions.smaug.acceptedKeys",1);

// selection for automatic send encrypted if all keys valid
// 0: never
// 1: if all keys found and accepted DEFAULT
pref("extensions.smaug.autoSendEncrypted",1);

// ask to confirm before sending
// 0: never DEFAULT
// 1: always
// 2: if send encrypted
// 3: if send unencrypted
// 4: if send (un)encrypted due to rules
pref("extensions.smaug.confirmBeforeSending",0);

// support different passwords for each key (not yet available)
pref("extensions.smaug.supportMultiPass",false);

// use GnuPG's default instead of Smaug/Mozilla comment of for signed messages
pref("extensions.smaug.useDefaultComment",true);

// allow encryption to newsgroups
pref("extensions.smaug.encryptToNews", false);
pref("extensions.smaug.warnOnSendingNewsgroups",true);

// use gpg passphrase agent for passphrase handling
pref("extensions.smaug.useGpgAgent",false);

// use PGP/MIME (0=never, 1=allow, 2=always)
// pref("extensions.smaug.usePGPMimeOption",1); -- OBSOLETE, see mail.identity.default.pgpMimeMode

// enable using gpgkeys_*
pref("extensions.smaug.useGpgKeysTool",true);

// show "conflicting rules" message (and remember selected state)
pref("extensions.smaug.warnOnRulesConflict",0);

// display a warning when the passphrase is cleared
pref("extensions.smaug.warnClearPassphrase",true);

// warn if gpg-agent is found and "remember passphrase for X minutes is active"
pref("extensions.smaug.warnGpgAgentAndIdleTime",true);

// display a warning when all keys are to be refreshed
pref("extensions.smaug.warnRefreshAll",true);

// display a warning when the keys for all contacts are downloaded
pref("extensions.smaug.warnDownloadContactKeys",true);

// display a warning if the broken character set ISO-2022-JP is used (and remember selected state)
pref("extensions.smaug.warnIso2022jp", 0);

// wrap HTML messages before sending inline PGP messages
pref("extensions.smaug.wrapHtmlBeforeSend",true);

// enable experimental features.
// WARNING: such features may unfinished functions or tests that can break
// existing functionality in Smaug and Thunderbird!
pref("extensions.smaug.enableExperiments",false);


/*
   Default pref values for the smaug per-identity
   settings
*/

// <EMO>
// pref("mail.identity.default.enablePgp",false);
pref("mail.identity.default.enablePgp",true);
// </EMO>
pref("mail.identity.default.pgpkeyId",  "");
pref("mail.identity.default.pgpKeyMode", 0);
pref("mail.identity.default.pgpSignPlain", false);
pref("mail.identity.default.pgpSignEncrypted", false);
pref("mail.identity.default.defaultSigningPolicy", 0);
pref("mail.identity.default.defaultEncryptionPolicy", 0);
pref("mail.identity.default.openPgpHeaderMode", 0);
pref("mail.identity.default.openPgpUrlName", "");
pref("mail.identity.default.pgpMimeMode", false);
pref("mail.identity.default.attachPgpKey", false);
pref("mail.identity.default.autoEncryptDrafts", true);

/*
   Other settings (change Mozilla behaviour)
*/

// disable flowed text by default
pref("mailnews.send_plaintext_flowed", false);
