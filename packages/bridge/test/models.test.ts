import { describe, expect, test } from "bun:test";
import { claudeModels, codexModels, cursorModels, modelCommands, resolveSettings } from "../src/models.ts";
import { modelArgs } from "../src/actions.ts";

describe("native model catalogs",()=>{
  test("Codex uses listed models and each model's advertised capabilities",()=>{
    const models=codexModels({models:[
      {slug:"real-sol",visibility:"list",supported_reasoning_levels:[{effort:"low"},{effort:"high"}],default_reasoning_level:"low",service_tiers:[{id:"priority",name:"Fast"}]},
      {slug:"internal-review",visibility:"hide"},
      {slug:"real-luna",visibility:"list",supported_reasoning_levels:[{effort:"medium"}]},
    ]});
    expect(models.map(m=>m.id)).toEqual(["real-sol","real-luna"]);
    expect(models[0]).toMatchObject({efforts:["low","high"],fast:true});
    expect(()=>resolveSettings("codex",{model:"real-luna",effort:"ultra"},models)).toThrow("effort");
    expect(()=>resolveSettings("codex",{model:"real-luna",fast:true},models)).toThrow("Fast");
    expect(modelCommands("codex",{model:"real-sol",effort:"high",fast:true})).toEqual(["/model real-sol --reasoning high --speed fast"]);
    expect(modelCommands("codex",{model:"real-sol",fast:false})).toEqual(["/model real-sol --speed standard"]);
  });
  test("Claude capabilities come from initialize, not inferred from a name",()=>{
    const models=claudeModels([{value:"opus",resolvedModel:"real-opus",displayName:"Real Opus",supportedEffortLevels:["low","max"],supportsFastMode:true},{value:"haiku",displayName:"Haiku"}]);
    expect(models[0]).toMatchObject({id:"real-opus",efforts:["low","max"],fast:true});
    expect(models[1]).toMatchObject({efforts:[],fast:false});
    expect(modelCommands("claude",{model:"real-opus",effort:"max",fast:false})).toEqual(["/model real-opus","/effort max","/fast off"]);
  });
  test("Cursor resolves effort and Fast only to real advertised variant IDs",()=>{
    const models=cursorModels("Available models\n\nauto - Auto (default)\nreal-sol-high - Sol High\nreal-sol-high-fast - Sol High Fast\nreal-sol-max - Sol Max\nTip: use --model\n");
    expect(models).toHaveLength(2);
    expect(resolveSettings("cursor",{model:"real-sol",effort:"high",fast:true},models)).toEqual({model:"real-sol-high-fast"});
    expect(resolveSettings("cursor",{model:"real-sol-high-fast",fast:false},models)).toEqual({model:"real-sol-high"});
    expect(()=>resolveSettings("cursor",{model:"real-sol",effort:"max",fast:true},models)).toThrow("combination");
    expect(resolveSettings("cursor",{model:"real-sol"},models)).toEqual({model:"real-sol-high"});
  });
  test("launch flags preserve model, effort and explicit Standard speed",()=>{
    expect(modelArgs("codex","real-sol",{effort:"high",fast:true})).toEqual(["-m","real-sol","-c",'model_reasoning_effort="high"',"-c",'service_tier="priority"']);
    expect(modelArgs("codex","real-sol",{fast:false})).toEqual(["-m","real-sol","-c",'service_tier="default"']);
    expect(modelArgs("claude","real-opus",{effort:"max",fast:false})).toEqual(["--model","real-opus","--effort","max","--settings",'{"fastMode":false}']);
    expect(()=>resolveSettings("other",{model:"custom",fast:true},[])).toThrow("does not support");
  });
});
