import {AdminError} from './client';
export async function boundedBody(request:Request):Promise<string>{
 const reader=request.body?.getReader();if(!reader)throw new AdminError('ADMIN_INVALID',400);
 const decoder=new TextDecoder();let text='';let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new AdminError('ADMIN_INVALID',413);}text+=decoder.decode(value,{stream:true});}return text+decoder.decode();
}
