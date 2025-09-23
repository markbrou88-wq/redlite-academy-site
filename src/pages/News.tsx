import { useEffect, useState } from 'react'; import { supabase } from '../lib/supabase';
type Post={ id:string; title:string; slug:string; body_md:string; published_at:string; author:string|null };
export default function News(){
  const [posts,setPosts]=useState<Post[]>([]);
  useEffect(()=>{ supabase.from('news_posts').select('*').order('published_at',{ascending:false}).then(({data})=>setPosts((data||[]) as any)); },[]);
  return (<section className="max-w-6xl mx-auto p-6">
    <h2 className="text-2xl font-bold mb-4">League News</h2>
    <div className="space-y-6">{posts.map(p=>(
      <article key={p.id} className="card"><h3 className="text-xl font-semibold">{p.title}</h3>
        <div className="text-xs text-gray-500">{new Date(p.published_at).toLocaleString()} {p.author?`• ${p.author}`:''}</div>
        <div className="prose mt-3 whitespace-pre-wrap">{p.body_md}</div></article>
    ))}</div></section>);
}