import { useState } from 'react'; import { supabase } from '../lib/supabase';
const slugify=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
export default function NewsAdmin(){
  const [title,setTitle]=useState(''); const [author,setAuthor]=useState(''); const [body,setBody]=useState(''); const [msg,setMsg]=useState('');
  const save=async()=>{ setMsg(''); if(!title||!body){setMsg('Title and body required');return;} const slug=slugify(title);
    const { error } = await supabase.from('news_posts').insert({ title, slug, body_md: body, author }); setMsg(error? error.message : 'Published!'); if(!error){ setTitle(''); setAuthor(''); setBody(''); } };
  return (<div className="card space-y-3"><h3 className="font-semibold">Publish News</h3>
    <input className="border rounded px-3 py-2 w-full" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)} />
    <input className="border rounded px-3 py-2 w-full" placeholder="Author (optional)" value={author} onChange={e=>setAuthor(e.target.value)} />
    <textarea className="border rounded px-3 py-2 w-full h-40" placeholder="Write in Markdown or plain text" value={body} onChange={e=>setBody(e.target.value)} />
    <button onClick={save} className="btn btn-red">Publish</button>{msg && <div className="text-sm">{msg}</div>}</div>);
}