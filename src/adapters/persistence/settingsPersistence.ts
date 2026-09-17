import { defaultTrainingRequest, parseTrainingRequest, type TrainingRequest } from "../../core/training/trainingIntent";
const KEY="accordion-trainer-v3-settings";
export const loadSettings=():TrainingRequest=>{try{return parseTrainingRequest(JSON.parse(localStorage.getItem(KEY)??"null"));}catch{return defaultTrainingRequest();}};
export const saveSettings=(request:TrainingRequest)=>localStorage.setItem(KEY,JSON.stringify(parseTrainingRequest(request)));
