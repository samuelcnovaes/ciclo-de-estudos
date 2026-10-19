import {mergeSnapshots,snapshotPatch,applySnapshotPatch} from './snapshot-merge.js';
export class SnapshotSync {
  static createPatch=snapshotPatch;
  static applyPatch=applySnapshotPatch;
  constructor({load,write,cache,onStatus,validate,onRemote}) {
    Object.assign(this,{load,write,cache,onStatus,validate,onRemote});
    this.version=null;this.pending=null;this.busy=null;this.blocked=false;this.saved='';this.base=null;this.baseKnown=false;
  }
  async restore() {
    const row=await this.load();this.baseKnown=true;
    if(row){this.validate(row.payload);this.version=row.version;this.saved=JSON.stringify(row.payload);this.base=JSON.parse(this.saved);}
    return row?.payload??null;
  }
  cachePending() {
    try { const saved=this.cache(this.pending);this.cacheError=null;this.caching=Promise.resolve(saved).catch(error=>{this.cacheError=error;}); }
    catch(error) { this.cacheError=error; }
  }
  mark(payload) {
    const text=JSON.stringify(payload);
    if(text===this.saved&&!this.pending)return;
    if(this.pending?.text===text)return;
    this.pending={payload:JSON.parse(text),text};
    this.cachePending();
    this.onStatus(this.blocked?'conflict':'pending');
  }
  rebase(row) {
    const remote=row?.payload??null;
    if(remote)this.validate(remote);
    const unknownBaseline=!this.baseKnown&&this.base===null&&this.pending&&remote&&this.version!==row.version;
    const merged=unknownBaseline?{...JSON.parse(JSON.stringify(remote)),syncRecovery:[...(remote.syncRecovery||[]),{id:globalThis.crypto.randomUUID(),savedAt:new Date().toISOString(),path:'rascunho-anterior',reason:'legacy-without-baseline',value:JSON.parse(this.pending.text)}]}:this.pending?mergeSnapshots(this.base??{},this.pending.payload,remote??{}):remote;
    if(merged)this.validate(merged);
    this.version=row?.version??null;this.base=remote;this.baseKnown=true;this.saved=remote?JSON.stringify(remote):'';this.blocked=false;
    const text=merged?JSON.stringify(merged):'';
    this.pending=text!==this.saved?{payload:merged,text}:null;
    this.cachePending();
    if(merged)this.onRemote?.(merged);
    return true;
  }
  async refresh() {
    if(this.busy)return this.busy;
    if(this.blocked)return;
    this.busy=(async()=>{try{const row=await this.load();if((row?.version??null)!==this.version){if(!this.rebase(row))return;}this.onStatus(this.pending?'pending':'saved');}catch(error){this.onStatus('error',error)}})();
    try{await this.busy;}finally{this.busy=null;}
    if(this.pending)return this.flush();
  }
  async flush() {
    if(this.busy)return this.busy;
    if(this.blocked||!this.pending)return;
    this.busy=(async()=>{
      this.onStatus('saving');
      try {
        let attempts=0;
        while(this.pending&&!this.blocked){
          const next=this.pending;
          await this.caching;
          let row;
          try{row=await this.write(next.payload,this.version)}catch(error){if(error.code!=='23505')throw error;row=null;}
          if(!row){if(++attempts>5){this.onStatus('pending');return;}const remote=await this.load();if(!this.rebase(remote))return;continue;}
          this.version=row.version;this.saved=next.text;this.base=next.payload;
          if(this.pending===next)this.pending=null;
          this.cachePending();
        }
        this.onStatus('saved');
      } catch(e){this.onStatus('error',e);}
    })();
    try{await this.busy;}finally{this.busy=null;}
  }
}
