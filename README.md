TRUE INTERNET-SCALE OBJECT SECURITY
===========

We have a problem with security in the Internet today, and it's not new.  Before we can encrypt data or 
verify signatures, we need a way for someone bootstrap and learn what cryptographic keys are needed.
Our security protocols have not formally specified a standardized way to securely bootstrap protocols, until
now.

Recently, however, a simple observation has sparked a flurry of innovation: for those protocols that use DNS,
secure key learning can be accomplished from DNS itself, and verified by the DNS Security Extensions
(DNSSEC).
The IETF has started standardizing a suite of protocols called DNS-based Authentication of Named Entities
[DANE](https://datatracker.ietf.org/wg/dane/charter/) to do secure key learning in a general way for 
Internet services.  

Among the things that DANE gives us is the ability to do true inter-organizational secure email (encrypting
email to anyone, verifying signatures without heavy managed PKIs, etc.).  This code offers a plugin to
Thunderbird to let users actually get true inter-organizational secure S/MIME email.


SMAUG Thunderbird Plugin
==========

The software in this repository has been constructed to serve as a proof of concept for 
S/MIME using DANE for message encryption and authentication.  This Add-on was forked from
the very impressive, and full-featured Enigmail Add-on (which is GPL licensed).

This prototype is tested on Red Hat Linux 6 and Mac OSX Version 10.9.

The origin of the work draws from the DANE working group in the IETF

  https://datatracker.ietf.org/wg/dane/charter/

Authored by Eric Osterweil eosterweil@verisign.com

Quick Start Guide
=================

To get going using S/MIME and DANE, follow these steps.  If you need 
to troubleshoot you will want to look at the smaug repo or elsewhere in this repo for more information:

* Install libsmaug ( https://github.com/verisign/smaug ):
  * ```autoreconf -i && ./configure && make && sudo make install```
* Compile Smaug Add-on (see &quot;Compiling&quot; Section, below):
  * ``git clone https://github.com/verisign/smaug-tbird-plugin.git && cd smaug-tbird-plugin&& make``
* Install Add-on (see &quot;Thunderbird Extension Installation&quot; Section, above):
  * If you don't have an S/MIME certificate already, you can generate one using a script from libsmaug's
installation: smime-gen.sh
  * Open Thunderbird
  * "Tools -> Add-ons"
  * Click on the sprocket in the upper right
  * "Install add-on from file..." (smaug-tbird-plugin/build) and choose "smaug.xpi"
  * Restart Thunderbird
  * If the setup wizard appears close the wizard
  * From the menu bar select "Smaug" -> "Key Management" menu, choose your S/MIME cert (~/sssmime/*-combined.pem by default)
  * Close the empty window that appears
* Encode your S/MIME cert into DANE SMIMEA resource records (RRs):
  * smimeagen &lt;your email address&gt; 3 0 0 &lt;your S/MIME cert file&gt; # (~/sssmime/*-combined.pem by default)

* Copy-and-paste the RRs into your zone.

Compiling
===========

```
git clone https://github.com/verisign/smaug-tbird-plugin.git
cd smaug-tbird-plugin
make
```

This will build the Add-on file ``smaug.xpi``


Thunderbird Extension Installation
===================================
Dependency: the Smaug reference library must be installed ( https://github.com/verisign/smaug )
Dependency: Thunderbird 31 (version tested)

* Install libsmaug
* Follow the above compiling instructions for this add-on
* Create (or reuse) an X.509 S/MIME certificate (a helper script for this is in the Smaug repo  
( https://github.com/verisign/smaug )
* Install this add-on in Thunderbird
* Configure the Smaug add-on with your personal S/MIME certificate

For example, install libsmaug (described in that project's README, https://github.com/verisign/smaug )

Next, compile this Add-on (described above)

Then, open Thunderbird, navigate to the "Tools -> Add-ons" menu.
<br/>
If you have not configured your mail account, in Thunderbird, do so now.
</br>
Next, click on the "Tools for all add-ons" button (top right corner of the tab, next to the search field).
<br/>
Choose "Install add-on from file..." option, and locate the newly compiled "smaug.xpi" file (in the "build/"
directory of the "smaug-tbird-plugin" repo.
<br/>
After installation (and relaunching Thunderbird), choose "Key Management" from the "Smaug" menu, and select your
S/MIME certificate.

Provisioning Your Zone With Your S/MIME Certificate(s)
=====================================================

Provisioning your zone is how Mail User Agents (MUAs), like Thunderbird, will be able to securely learn your 
signing and encryption keys.  Online portals like the one listed here &lt;TBD&gt; help offload the management 
details and access complexities of provisioning and maintaining S/MIME certificates in DNS zones.  If, on 
the other hand, you prefer to manage the material in your own zone, this is how to do it:

* Make sure your zone is DNSSEC enabled (from the root zone, to your TLD, and all the way to your zone).
* Use the tool ``smimeagen`` (installed with libsmaug, https://github.com/verisign/smaug ) to convert your S/MIME
certificate into SMIMEA records.
* Copy-and-paste the output of ``smimeagen`` into your DNS zone file, re-sign your zone, and reload it.
* Whenever you change your S/MIME certificate(s), be sure you update your DNS zone.
