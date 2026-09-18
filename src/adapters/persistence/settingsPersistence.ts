import { defaultTrainingRequest, parseTrainingRequest, type TrainingRequest } from "../../core/training/trainingIntent";
const KEY="accordion-trainer-v3-settings";
const PARAM="settings";
export const parseStoredSettings=(value:string|null):TrainingRequest|undefined=>{try{return value?parseTrainingRequest(JSON.parse(value)):undefined;}catch{return undefined;}};
export const loadSettings=():TrainingRequest=>parseStoredSettings(new URLSearchParams(location.search).get(PARAM))??parseStoredSettings(localStorage.getItem(KEY))??defaultTrainingRequest();
export const saveSettings=(request:TrainingRequest)=>{const parsed=parseTrainingRequest(request),serialized=JSON.stringify(parsed);localStorage.setItem(KEY,serialized);const url=new URL(location.href);url.searchParams.set(PARAM,serialized);history.replaceState(null,"",url);};
export const clearSettings=()=>{localStorage.removeItem(KEY);const url=new URL(location.href);url.searchParams.delete(PARAM);history.replaceState(null,"",url);};
