export async function readSecret(prompt){
  if(!process.stdin.isTTY)throw new Error('Interactive terminal required; do not put passwords in command arguments.');
  process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
  return new Promise((resolve,reject)=>{let value='';const onData=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){process.stdin.off('data',onData);reject(new Error('Cancelled'));return;}if(char==='\r'||char==='\n'){process.stdin.off('data',onData);resolve(value);return;}if(char==='\u007f'){value=value.slice(0,-1);continue;}value+=char;}};process.stdin.on('data',onData);}).finally(()=>{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');});
}
