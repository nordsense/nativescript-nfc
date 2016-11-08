import {NfcApi, WriteTagOptions} from "./nfc.common";
import * as utils from "utils/utils";

import * as application from "application";
import * as frame from "ui/frame";

declare let Array: any;


class NfcIntentHandler {
  public savedIntent: android.content.Intent = null;

  constructor() {
  }

  parseMessage(): void {
    let intent = application.android.foregroundActivity.getIntent();
    if (intent === null || this.savedIntent === null) {
      return;
    }

    let action = intent.getAction();
    if (action === null) {
      return;
    }

    let tag = intent.getParcelableExtra(android.nfc.NfcAdapter.EXTRA_TAG) as android.nfc.Tag;
    let messages = intent.getParcelableArrayExtra(android.nfc.NfcAdapter.EXTRA_NDEF_MESSAGES);

    if (action === android.nfc.NfcAdapter.ACTION_NDEF_DISCOVERED) {
      let ndef = android.nfc.tech.Ndef.get(tag);

      let ndefJson = this.ndefToJSON(ndef);

      if (ndef === null && messages !== null) {
        if (messages.length > 0) {
          let message = messages[0] as android.nfc.NdefMessage;
          ndefJson["ndefMessage"] = this.messageToJSON(message);
          ndefJson["type"] = "NDEF Push Protocol";
        }
        if (messages.length > 1) {
          console.log("Expected 1 ndefMessage but found " + messages.length);
        }
      }

      // TODO call onNdefMime event with ndefJson payload
      console.log("ndefJson: " + JSON.stringify(ndefJson));

    } else if (action === android.nfc.NfcAdapter.ACTION_TECH_DISCOVERED) {
      let techList = tag.getTechList();

      for (let i = 0; i < tag.getTechList().length; i++) {
        let tech = tag.getTechList()[i];
        /*
        let tagTech = techList(t);
        console.log("tagTech: " + tagTech);
        if (tagTech === NdefFormatable.class.getName()) {
          fireNdefFormatableEvent(tag);
        } else if (tagTech === Ndef.class.getName()) {
          let ndef = Ndef.get(tag);
          fireNdefEvent(NDEF, ndef, messages);
        }
        */
      }

    } else if (action === android.nfc.NfcAdapter.ACTION_TAG_DISCOVERED) {
      let result = {
        id: tag === null ? null : this.byteArrayToJSON(tag.getId()),
        techList: this.techListToJSON(tag)
      };
      // TODO invoke onTag callback
      console.log("result: " + JSON.stringify(result));
    }
  }

  byteArrayToJSON(bytes): string {
    let json = new org.json.JSONArray();
    for (let i = 0; i < bytes.length; i++) {
      json.put(bytes[i]);
    }
    return json.toString();
  }

  bytesToHexString(bytes): string {
    let dec, hexstring, bytesAsHexString = "";
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 0) {
        dec = bytes[i];
      } else {
        dec = 256 + bytes[i];
      }
      hexstring = dec.toString(16);
      // zero padding
      if (hexstring.length === 1) {
        hexstring = "0" + hexstring;
      }
      bytesAsHexString += hexstring;
    }
    return bytesAsHexString;
  }

  bytesToString(bytes): string {
    let result = "";
    let i, c, c1, c2, c3;
    i = c = c1 = c2 = c3 = 0;

    // Perform byte-order check
    if (bytes.length >= 3) {
      if ((bytes[0] & 0xef) === 0xef && (bytes[1] & 0xbb) === 0xbb && (bytes[2] & 0xbf) === 0xbf) {
        // stream has a BOM at the start, skip over
        i = 3;
      }
    }

    while ( i < bytes.length ) {
      c = bytes[i] & 0xff;

      if ( c < 128 ) {
        result += String.fromCharCode(c);
        i++;

      } else if ( (c > 191) && (c < 224) ) {
        if ( i + 1 >= bytes.length ) {
          throw "Un-expected encoding error, UTF-8 stream truncated, or incorrect";
        }
        c2 = bytes[i + 1] & 0xff;
        result += String.fromCharCode( ((c & 31) << 6) | (c2 & 63) );
        i += 2;

      } else {
        if ( i + 2 >= bytes.length  || i + 1 >= bytes.length ) {
          throw "Un-expected encoding error, UTF-8 stream truncated, or incorrect";
        }
        c2 = bytes[i + 1] & 0xff;
        c3 = bytes[i + 2] & 0xff;
        result += String.fromCharCode( ((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63) );
        i += 3;
      }
    }
    return result;
  }

  techListToJSON(tag): Array<string> {
    if (tag !== null) {
      let techList = [];
      for (let i = 0; i < tag.getTechList().length; i++) {
        techList.push(tag.getTechList()[i]);
      }
      return techList;
    }
    return null;
  }

  ndefToJSON(ndef: android.nfc.tech.Ndef): {} {
    let result = {};

    if (ndef === null) {
      return result;
    }

    let tag = ndef.getTag();
    if (tag !== null) {
      result["id"] = this.byteArrayToJSON(tag.getId());
      result["techList"] = this.techListToJSON(tag);
    }

    result["type"] = ndef.getType();
    result["maxSize"] = ndef.getMaxSize();
    result["writable"] = ndef.isWritable();
    result["ndefMessage"] = this.messageToJSON(ndef.getCachedNdefMessage());
    result["canMakeReadOnly"] = ndef.canMakeReadOnly();
    return result;
  }

  messageToJSON(message: android.nfc.NdefMessage): {} {
    if (message === null) {
      return null;
    }
    let records = message.getRecords();
    let result = [];
    for (let i = 0; i < records.length; i++) {
      let record = this.recordToJSON(records[i]);
      result.push(record);
    }
    return result;
  }

  recordToJSON(record: android.nfc.NdefRecord): {} {
    let payloadAsString = this.bytesToString(record.getPayload());
    let languageCodeLength = record.getPayload()[0];
    return {
      tnf: record.getTnf(),
      type: this.byteArrayToJSON(record.getType()),
      id: this.byteArrayToJSON(record.getId()),
      payload: this.byteArrayToJSON(record.getPayload()),
      payloadAsHexString: this.bytesToHexString(record.getPayload()),
      payloadAsStringWithLanguageCode: payloadAsString,
      payloadAsString: payloadAsString.substring(languageCodeLength + 1)
    };
  }
}
let nfcIntentHandler = new NfcIntentHandler();


@JavaProxy("com.tns.NativeScriptActivity")
class Activity extends android.app.Activity {
  private _callbacks: frame.AndroidActivityCallbacks;

  onCreate(savedInstanceState: android.os.Bundle): void {
    console.log("--- create");
    if (!this._callbacks) {
      (<any>frame).setActivityCallbacks(this);
    }
    this._callbacks.onCreate(this, savedInstanceState, super.onCreate);
  }

  onNewIntent(intent: android.content.Intent): void {
    super.onNewIntent(intent);
    application.android.foregroundActivity.setIntent(intent);
    nfcIntentHandler.savedIntent = intent;
    nfcIntentHandler.parseMessage();
  }
}

export class Nfc implements NfcApi {
  private pendingIntent: android.app.PendingIntent;
  private intentFilters: any;
  private techLists: any;

  constructor() {
    this.intentFilters = [];
    this.techLists = Array.create("[Ljava.lang.String;", 0);

    let intent = new android.content.Intent(application.android.foregroundActivity, application.android.foregroundActivity.getClass());
    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
    this.pendingIntent = android.app.PendingIntent.getActivity(application.android.foregroundActivity, 0, intent, 0);

    // start nfc
    let nfcAdapter = android.nfc.NfcAdapter.getDefaultAdapter(application.android.foregroundActivity);
    if (nfcAdapter !== null) {
      nfcAdapter.enableForegroundDispatch(application.android.foregroundActivity, this.pendingIntent, this.intentFilters, this.techLists);
    }

    // when peer2peer is supported, handle pending push messages here

    // handle any pending intent
    nfcIntentHandler.parseMessage();
  }

  public available(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let nfcAdapter = android.nfc.NfcAdapter.getDefaultAdapter(utils.ad.getApplicationContext());
      resolve(nfcAdapter !== null);
    });
  };

  public enabled(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let nfcAdapter = android.nfc.NfcAdapter.getDefaultAdapter(utils.ad.getApplicationContext());
      resolve(nfcAdapter !== null && nfcAdapter.isEnabled());
    });
  };

  public startListening(): Promise<any> {
    let that = this;
    // TODO don't add if already listening(?)
    return new Promise((resolve, reject) => {
      that.intentFilters.push(new android.content.IntentFilter(android.nfc.NfcAdapter.ACTION_TAG_DISCOVERED));
      resolve(true);
    });
  };

  public stopListening(): Promise<any> {
    return new Promise((resolve, reject) => {
      resolve(true);
    });
  };

  public eraseTag(): Promise<any> {
    let that = this;
    return new Promise((resolve, reject) => {
      let intent = application.android.foregroundActivity.getIntent();
      if (intent === null || nfcIntentHandler.savedIntent === null) {
        reject("Can not erase tag; didn't receive an intent");
        return;
      }

      let tag = nfcIntentHandler.savedIntent.getParcelableExtra(android.nfc.NfcAdapter.EXTRA_TAG) as android.nfc.Tag;
      let records = new Array.create(android.nfc.NdefRecord, 1);

      let tnf = android.nfc.NdefRecord.TNF_EMPTY;
      let type = Array.create("byte", 0);
      let id = Array.create("byte", 0);
      let payload = Array.create("byte", 0);
      let record = new android.nfc.NdefRecord(tnf, type, id, payload);

      records[0] = record;

      // avoiding a TS issue in the generate Android definitions
      let ndefClass = android.nfc.NdefMessage as any;
      let ndefMessage = new ndefClass(records);

      let errorMessage = that.writeNdefMessage(ndefMessage, tag);
      if (errorMessage === null) {
        resolve();
      } else {
        reject(errorMessage);
      }
    });
  };

  public writeTag(arg: WriteTagOptions): Promise<any> {
    let that = this;
    return new Promise((resolve, reject) => {
      if (!arg) {
        reject("Nothing passed to write");
        return;
      }
      let intent = application.android.foregroundActivity.getIntent();
      if (intent === null || nfcIntentHandler.savedIntent === null) {
        reject("Can not write to tag; didn't receive an intent");
        return;
      }

      let tag = nfcIntentHandler.savedIntent.getParcelableExtra(android.nfc.NfcAdapter.EXTRA_TAG) as android.nfc.Tag;
      console.log("write, tag: " + tag);

      let records = that.jsonToNdefRecords(arg);
      console.log("write, records: " + records);

      // avoiding a TS issue in the generate Android definitions
      let ndefClass = android.nfc.NdefMessage as any;
      let ndefMessage = new ndefClass(records);

      let errorMessage = that.writeNdefMessage(ndefMessage, tag);
      if (errorMessage === null) {
        resolve();
      } else {
        reject(errorMessage);
      }
    });
  };

  private writeNdefMessage(message: android.nfc.NdefMessage, tag: android.nfc.Tag): string {
    let ndef = android.nfc.tech.Ndef.get(tag);
    console.log("nfed: " + ndef);

    if (ndef === null) {
      let formatable = android.nfc.tech.NdefFormatable.get(tag);
      if (formatable === null) {
        return "Tag doesn't support NDEF";
      }
      formatable.connect();
      console.log("formatable nfed connected");
      formatable.format(message);
      formatable.close();
      return null;
    }

    ndef.connect();
    console.log("nfed connected");

    if (!ndef.isWritable()) {
      return "Tag not writable";
    }

    let size = message.toByteArray().length;
    let maxSize = ndef.getMaxSize();

    if (maxSize < size) {
      return "Message too long; tag capacity is " + maxSize + " bytes, message is " + size + " bytes";
    }

    ndef.writeNdefMessage(message);
    ndef.close();
    return null;
  }

  private jsonToNdefRecords(input: WriteTagOptions): Array<android.nfc.NdefRecord> {
    let records = new Array.create(android.nfc.NdefRecord, input.textRecords.length);

    let recordCounter: number = 0;

    if (input.textRecords !== null) {
      for (let i in input.textRecords) {
        let textRecord = input.textRecords[i];

        let langCode = textRecord.languageCode || "en";
        let encoded = this.stringToBytes(langCode + textRecord.text);
        encoded.unshift(langCode.length);

        let tnf = android.nfc.NdefRecord.TNF_WELL_KNOWN; // 0x01;

        let type = Array.create("byte", 1);
        type[0] = 0x54;

        let id = Array.create("byte", textRecord.id ? textRecord.id.length : 0);
        if (textRecord.id) {
          for (let j = 0; j < textRecord.id.length; j++) {
            id[j] = textRecord.id[j];
          }
        }

        let payload = Array.create("byte", encoded.length);
        for (let n = 0; n < encoded.length; n++) {
          payload[n] = encoded[n];
        }

        let record = new android.nfc.NdefRecord(tnf, type, id, payload);
        console.log("record: " + record);

        records[recordCounter++] = record;
      }
    }
    return records;
  }

  private stringToBytes (input: string) {
    let bytes = [];
    for (let n = 0; n < input.length; n++) {
      let c = input.charCodeAt(n);
      if (c < 128) {
        bytes[bytes.length] = c;
      } else if ((c > 127) && (c < 2048)) {
        bytes[bytes.length] = (c >> 6) | 192;
        bytes[bytes.length] = (c & 63) | 128;
      } else {
        bytes[bytes.length] = (c >> 12) | 224;
        bytes[bytes.length] = ((c >> 6) & 63) | 128;
        bytes[bytes.length] = (c & 63) | 128;
      }
    }
    return bytes;
  }
}