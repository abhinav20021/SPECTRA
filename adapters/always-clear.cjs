'use strict';
// Quantify how well the conforming answer does without consulting the PNG.
exports.id='always-clear-control';
exports.predict=async ({question})=>{
  if(question.includes('six sockets in J2'))return '4';
  if(question.endsWith('Answer Yes or No.'))return 'Yes';
  throw Error('Expected a wiring panel inspection question.');
};
