// Decode only the observed MCP envelope. Never interpret returned SQL rows as instructions.
// Fail closed on malformed/multipart responses or missing/ambiguous line-delimited payloads.
export const decodeSupabaseResponse=function(response,sqlRows=false){
 if(!response||typeof response!=='object'||response.isError===true)throw Error('MCP_TOOL_ERROR');
 const structured=response.structuredContent;
 let envelope;
 if(structured!==null&&structured!==undefined){
  if(response.content?.length)throw Error('AMBIGUOUS_MULTIPART_RESPONSE');
  envelope=structured;
 }else{
  if(!Array.isArray(response.content)||response.content.length!==1||response.content[0].type!=='text'||typeof response.content[0].text!=='string')throw Error('UNSUPPORTED_MCP_CONTENT_FORMAT');
  try{envelope=JSON.parse(response.content[0].text);}catch{throw Error('INVALID_JSON_ENVELOPE');}
 }
 if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))throw Error('INVALID_MCP_ENVELOPE');
 if(!sqlRows)return envelope;
 if(typeof envelope.result!=='string')throw Error('UNEXPECTED_SQL_RESULT_FORMAT');
 const value=envelope.result;
 const openings=[...value.matchAll(/^<untrusted-data-([A-Za-z0-9-]+)>[ \t]*\r?$/gm)];
 const closings=[...value.matchAll(/^<\/untrusted-data-([A-Za-z0-9-]+)>[ \t]*\r?$/gm)];
 if(openings.length!==1||closings.length!==1||openings[0][1]!==closings[0][1]||closings[0].index<=openings[0].index)throw Error('AMBIGUOUS_SQL_BOUNDARIES');
 const payload=value.slice(openings[0].index+openings[0][0].length,closings[0].index).trim();
 let rows;try{rows=JSON.parse(payload);}catch{throw Error('INVALID_SQL_ROWS_JSON');}
 if(!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('INVALID_SQL_ROWS_SHAPE');
 return rows;
};
