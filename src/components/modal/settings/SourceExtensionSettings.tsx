import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useInterfaceLight } from '../../../hooks/useInterfaceAppearance';
import { ChevronRight } from 'lucide-react';
import ThemedDialog from '../../shared/ThemedDialog';
import { useLxSourceStore } from '../../../stores/useLxSourceStore';
import { useSettingsModalStore } from '../../../stores/useSettingsModalStore';
import { readFallbackConfig, writeFallbackConfig } from '../../../services/onlineMusic/fallbackConfig';
import { installBuiltinLxPresets } from '../../../services/lxSource/presetInstall';

// src/components/modal/settings/SourceExtensionSettings.tsx
export default function SourceExtensionSettings() {
    const isLight=useInterfaceLight(false);
    const [page,setPage]=useState<'advanced'|'experimental'|null>(null);
    const [error,setError]=useState('');
    const [unblockBaseUrl,setUnblockBaseUrl]=useState('');
    const [customApiJson,setCustomApiJson]=useState('');
    const state=useLxSourceStore();
    const settingsOpen=useSettingsModalStore(s=>s.settingsModalState.isOpen);
    useEffect(()=>()=>{useLxSourceStore.getState().cancelConsent();useLxSourceStore.getState().close();},[]);
    useEffect(()=>{const config=readFallbackConfig();setUnblockBaseUrl(config.unblockBaseUrl);setCustomApiJson(config.customApi?JSON.stringify(config.customApi,null,2):'');},[]);
    useEffect(()=>{if(!settingsOpen)setPage(null);},[settingsOpen]);
    const act=(work:()=>void|Promise<unknown>)=>{setError('');try{void Promise.resolve(work()).catch(()=>setError('保存失败，请重试'));}catch{setError('保存失败，请重试');}};
    const saveUnblockBaseUrl=()=>{setError('');const current=readFallbackConfig();if(!writeFallbackConfig({...current,unblockBaseUrl}))setError('pyncmd 服务地址必须是 HTTP(S) 地址');};
    const saveCustomApi=()=>{setError('');try{const parsed=JSON.parse(customApiJson);if(!writeFallbackConfig({...readFallbackConfig(),customApi:parsed}))setError('自定义 API 配置缺少有效 apiUrl');}catch{setError('自定义 API 配置不是合法 JSON');}};
    return <>
        <button type="button" className="ty-source-entry" onClick={()=>setPage('advanced')} data-settings-layout="row" data-settings-style='{"font":13,"minHeight":48,"padding":[12,12,12,12],"radius":12,"border":true}'>高级扩展<ChevronRight size={18}/></button>
        {page&&createPortal(<ThemedDialog isOpen title={page==='advanced'?'高级扩展':'实验性功能'} onClose={()=>{state.cancelConsent();setPage(page==='experimental'?'advanced':null);}}>
            <div className="ty-lx-manager" data-light={isLight||undefined} data-settings-layout="column" data-settings-style='{"gap":16}'>
                {page==='advanced'?<button type="button" onClick={()=>setPage('experimental')} data-settings-layout="row" data-settings-style='{"minHeight":48,"border":true,"radius":12,"padding":[12,12,12,12]}'>实验性功能<ChevronRight size={18}/></button>:<>
                    <div className="ty-lx-setting-row" data-settings-layout="row" data-settings-style='{"align":"between","gap":12,"minHeight":48}'><span>第三方音源扩展</span><button type="button" role="switch" aria-label="第三方音源扩展" aria-checked={state.extensionEnabled} onClick={()=>act(()=>state.setExtensionEnabled(!state.extensionEnabled))}><i/></button></div>
                    <p data-settings-layout="wrap" data-settings-style='{"font":12,"tone":"muted"}'>{state.extensionEnabled?'已开启。仅使用用户自行配置的第三方音源。':'已关闭。已保存的音源与配置会保留，重新开启后可恢复。'}</p>
                    {state.extensionEnabled&&<button type="button" onClick={state.show} data-settings-layout="row" data-settings-style='{"minHeight":48,"border":true,"radius":12,"padding":[12,12,12,12]}'>管理第三方音源<ChevronRight size={18}/></button>}
                    {!state.extensionEnabled&&state.scripts.length>0&&<div data-settings-layout="column" data-settings-style='{"gap":10}'>
                        <h3>已保存音源</h3>{state.scripts.map(script=><div key={script.id} data-settings-layout="card" data-settings-style='{"gap":8,"border":true,"radius":12,"padding":[12,12,12,12]}'>
                            <span>{script.name}</span><div data-settings-layout="wrap" data-settings-style='{"gap":8}'>
                                {state.activeId===script.id&&<button type="button" onClick={()=>act(()=>state.activate(null))}>取消恢复此音源</button>}
                                <button type="button" onClick={()=>act(()=>state.remove(script.id))}>删除</button>
                            </div>
                        </div>)}
                    </div>}
                    <button type="button" disabled={!state.extensionEnabled} onClick={()=>act(async()=>{if(!await installBuiltinLxPresets())setError('请先确认实验性功能风险');})}>一键添加内置音源（递归换源）</button>
                    <div className="ty-lx-fallback-config">
                        <h3>播放失败备用音源</h3>
                        <label>pyncmd 服务地址
                            <input value={unblockBaseUrl} onChange={event=>setUnblockBaseUrl(event.target.value)} placeholder="HTTP(S) 地址"/>
                        </label>
                        <button type="button" onClick={saveUnblockBaseUrl}>保存 pyncmd 服务</button>
                        <label>自定义 API 配置
                            <textarea value={customApiJson} onChange={event=>setCustomApiJson(event.target.value)} placeholder="JSON 配置" rows={5}/>
                        </label>
                        <button type="button" onClick={saveCustomApi}>保存自定义 API</button>
                        <p>GD 音乐台无需配置，播放失败时自动参与换源。</p>
                    </div>
                    {error&&<p role="alert">{error}</p>}
                </>}
            </div>
        </ThemedDialog>,document.body)}
    </>;
}
