import { emptyAdaptiveProfile, type AdaptiveProfile } from "../../core/training/adaptiveProfile";
const KEY="accordion-trainer-v3-learning";
export const loadLearningProfile=():AdaptiveProfile=>{try{const x=JSON.parse(localStorage.getItem(KEY)??"null") as AdaptiveProfile;return x?.version===1?x:emptyAdaptiveProfile();}catch{return emptyAdaptiveProfile();}};
export const saveLearningProfile=(profile:AdaptiveProfile)=>localStorage.setItem(KEY,JSON.stringify(profile));
