export type GeneratedCandidate<T>={seed:number;value:T};

/** Try candidates in order while preserving the final useful generation error. */
export const generateFirstValidCandidate=<T>(seeds:readonly number[],generate:(seed:number)=>T):GeneratedCandidate<T>=>{
 let lastError:unknown;
 for(const seed of seeds){try{return{seed,value:generate(seed)};}catch(error){lastError=error;}}
 if(lastError!==undefined)throw lastError;
 throw new Error("No generation seeds were provided");
};
