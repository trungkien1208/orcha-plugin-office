// Generated from office/manifest.json by scripts/build-landing.ts. Never edit frame numbers here.
export const LANDING_ART: {
  logo:string; logo144:string; logo224:string; bossPortrait:string; portraits:Record<string,string>;
  paperwork:Record<"office"|"compound",Record<string,string>>;
  frame:{width:number;height:number;columns:number;rows:number};
  sheets:Record<string,{sheet:string;polo?:string}>; animations:Record<string,number[]>;
  boss:{office:string;compound:string;animations:Record<string,number[]>};
  bouncer:{office:string;compound:string;animations:Record<string,number[]>};
  props:Record<string,string>; effects:Record<string,string>;
  monitorScreen:{x:number;y:number;width:number;height:number};
  effectFrames:Record<string,{frame:{width:number;height:number};columns:number}>;
} = {
  "logo": "office/landing/brand/easy-chair-224.png",
  "logo144": "office/landing/brand/easy-chair-144.png",
  "logo224": "office/landing/brand/easy-chair-224.png",
  "bossPortrait": "office/theme-office/characters/boss-portrait.png",
  "portraits": {
    "headset": "office/characters/headset-portrait.png",
    "red-cap": "office/characters/red-cap-portrait.png",
    "bun": "office/characters/bun-portrait.png",
    "shiny": "office/characters/shiny-portrait.png",
    "curly": "office/characters/curly-portrait.png",
    "mohawk": "office/characters/mohawk-portrait.png",
    "silver": "office/characters/silver-portrait.png",
    "specs": "office/characters/specs-portrait.png",
    "robot": "office/characters/robot-portrait.png",
    "crt-bot": "office/characters/crt-bot-portrait.png",
    "shiba": "office/characters/shiba-portrait.png",
    "husky": "office/characters/husky-portrait.png",
    "tabby": "office/characters/tabby-portrait.png",
    "black-cat": "office/characters/black-cat-portrait.png",
    "raccoon": "office/characters/raccoon-portrait.png",
    "capybara": "office/characters/capybara-portrait.png",
    "crew-cut": "office/characters/crew-cut-portrait.png",
    "ponytail": "office/characters/ponytail-portrait.png",
    "beard": "office/characters/beard-portrait.png",
    "bob": "office/characters/bob-portrait.png",
    "spike": "office/characters/spike-portrait.png",
    "braids": "office/characters/braids-portrait.png",
    "beanie": "office/characters/beanie-portrait.png"
  },
  "paperwork": {
    "office": {
      "cork": "office/landing/paperwork/office-cork.png",
      "note": "office/landing/paperwork/office-note.png",
      "noteAlt": "office/landing/paperwork/office-noteAlt.png",
      "wallNotice": "office/landing/paperwork/office-wallNotice.png",
      "timeCard": "office/landing/paperwork/office-timeCard.png",
      "masthead": "office/landing/paperwork/office-masthead.png",
      "pin": "office/landing/paperwork/office-pin.png",
      "punch": "office/landing/paperwork/office-punch.png"
    },
    "compound": {
      "cork": "office/landing/paperwork/compound-cork.png",
      "note": "office/landing/paperwork/compound-note.png",
      "noteAlt": "office/landing/paperwork/compound-noteAlt.png",
      "wallNotice": "office/landing/paperwork/compound-wallNotice.png",
      "timeCard": "office/landing/paperwork/compound-timeCard.png",
      "masthead": "office/landing/paperwork/compound-masthead.png",
      "pin": "office/landing/paperwork/compound-pin.png",
      "punch": "office/landing/paperwork/compound-punch.png"
    }
  },
  "frame": {
    "width": 48,
    "height": 72,
    "columns": 4,
    "rows": 11
  },
  "sheets": {
    "headset": {
      "sheet": "office/characters/headset.png",
      "polo": "office/characters/headset-polo.png"
    },
    "red-cap": {
      "sheet": "office/characters/red-cap.png",
      "polo": "office/characters/red-cap-polo.png"
    },
    "bun": {
      "sheet": "office/characters/bun.png",
      "polo": "office/characters/bun-polo.png"
    },
    "shiny": {
      "sheet": "office/characters/shiny.png",
      "polo": "office/characters/shiny-polo.png"
    },
    "curly": {
      "sheet": "office/characters/curly.png",
      "polo": "office/characters/curly-polo.png"
    },
    "mohawk": {
      "sheet": "office/characters/mohawk.png",
      "polo": "office/characters/mohawk-polo.png"
    },
    "silver": {
      "sheet": "office/characters/silver.png",
      "polo": "office/characters/silver-polo.png"
    },
    "specs": {
      "sheet": "office/characters/specs.png",
      "polo": "office/characters/specs-polo.png"
    },
    "robot": {
      "sheet": "office/characters/robot.png",
      "polo": "office/characters/robot-polo.png"
    },
    "crt-bot": {
      "sheet": "office/characters/crt-bot.png",
      "polo": "office/characters/crt-bot-polo.png"
    },
    "shiba": {
      "sheet": "office/characters/shiba.png",
      "polo": "office/characters/shiba-polo.png"
    },
    "husky": {
      "sheet": "office/characters/husky.png",
      "polo": "office/characters/husky-polo.png"
    },
    "tabby": {
      "sheet": "office/characters/tabby.png",
      "polo": "office/characters/tabby-polo.png"
    },
    "black-cat": {
      "sheet": "office/characters/black-cat.png",
      "polo": "office/characters/black-cat-polo.png"
    },
    "raccoon": {
      "sheet": "office/characters/raccoon.png",
      "polo": "office/characters/raccoon-polo.png"
    },
    "capybara": {
      "sheet": "office/characters/capybara.png",
      "polo": "office/characters/capybara-polo.png"
    },
    "crew-cut": {
      "sheet": "office/characters/crew-cut.png",
      "polo": "office/characters/crew-cut-polo.png"
    },
    "ponytail": {
      "sheet": "office/characters/ponytail.png",
      "polo": "office/characters/ponytail-polo.png"
    },
    "beard": {
      "sheet": "office/characters/beard.png",
      "polo": "office/characters/beard-polo.png"
    },
    "bob": {
      "sheet": "office/characters/bob.png",
      "polo": "office/characters/bob-polo.png"
    },
    "spike": {
      "sheet": "office/characters/spike.png",
      "polo": "office/characters/spike-polo.png"
    },
    "braids": {
      "sheet": "office/characters/braids.png",
      "polo": "office/characters/braids-polo.png"
    },
    "beanie": {
      "sheet": "office/characters/beanie.png",
      "polo": "office/characters/beanie-polo.png"
    }
  },
  "animations": {
    "walkDown": [
      0,
      1,
      2,
      3
    ],
    "walkLeft": [
      4,
      5,
      6,
      7
    ],
    "walkUp": [
      8,
      9,
      10,
      11
    ],
    "sitUp": [
      12
    ],
    "standDown": [
      13
    ],
    "waveDown": [
      14
    ],
    "spare": [
      15,
      30,
      31,
      34,
      35
    ],
    "typeUp": [
      16,
      17,
      18,
      19
    ],
    "handUp": [
      20,
      21
    ],
    "relaxUp": [
      22,
      23
    ],
    "napUp": [
      24,
      25
    ],
    "standUp": [
      26
    ],
    "sitDown": [
      27
    ],
    "idleDown": [
      28,
      29
    ],
    "zappedUp": [
      32,
      33
    ],
    "lifted": [
      36,
      37
    ],
    "struggle": [
      38,
      39
    ],
    "carriedDown": [
      40,
      41
    ],
    "tossed": [
      42,
      43
    ]
  },
  "boss": {
    "compound": "office/characters/boss.png",
    "office": "office/theme-office/characters/boss.png",
    "animations": {
      "walkDown": [
        0,
        1,
        2,
        3
      ],
      "walkLeft": [
        4,
        5,
        6,
        7
      ],
      "walkUp": [
        8,
        9,
        10,
        11
      ],
      "idleWalkie": [
        12,
        13
      ],
      "tapShoulder": [
        14,
        15
      ],
      "knockDesk": [
        16,
        17
      ],
      "pressBuzzer": [
        18,
        19
      ],
      "newspaper": [
        20,
        21,
        22
      ],
      "spare": [
        23,
        35,
        38,
        39
      ],
      "megaphone": [
        24,
        25
      ],
      "coffee": [
        26,
        27
      ],
      "highFive": [
        28,
        29
      ],
      "watch": [
        30,
        31
      ],
      "whipCrack": [
        32,
        33,
        34
      ],
      "zapper": [
        36,
        37
      ]
    }
  },
  "bouncer": {
    "compound": "office/characters/bouncer.png",
    "office": "office/theme-office/characters/bouncer.png",
    "animations": {
      "walkDown": [
        0,
        1,
        2,
        3
      ],
      "walkLeft": [
        4,
        5,
        6,
        7
      ],
      "walkUp": [
        8,
        9,
        10,
        11
      ],
      "reach": [
        12,
        13,
        14,
        15
      ],
      "grabLeft": [
        16,
        17
      ],
      "grabRight": [
        18,
        19
      ],
      "carryLeft": [
        20,
        21,
        22,
        23
      ],
      "carryDown": [
        24,
        25,
        26,
        27
      ],
      "carryUp": [
        28,
        29,
        30,
        31
      ],
      "toss": [
        32,
        33,
        34
      ],
      "dustOff": [
        36,
        37
      ],
      "spare": [
        35,
        38,
        39
      ]
    }
  },
  "props": {
    "benchL": "office/objects/bench-l.png",
    "benchM": "office/objects/bench-m.png",
    "benchR": "office/objects/bench-r.png",
    "monitor": "office/objects/monitor.png",
    "chairBack": "office/objects/chair-back.png",
    "benchTag": "office/objects/bench-tag.png"
  },
  "effects": {
    "markerNeeds": "office/ui/marker-needs.png",
    "stampUrgent": "office/ui/stamp-urgent.png",
    "stampDone": "office/ui/stamp-done.png",
    "fxPaperPlane": "office/ui/fx-paper-plane.png",
    "newspaper": "office/ui/newspaper.png"
  },
  "monitorScreen": {
    "x": 4,
    "y": 4,
    "width": 24,
    "height": 12
  },
  "effectFrames": {
    "markerNeeds": {
      "frame": {
        "width": 16,
        "height": 24
      },
      "columns": 2
    },
    "fxPaperPlane": {
      "frame": {
        "width": 16,
        "height": 16
      },
      "columns": 4
    }
  }
};
