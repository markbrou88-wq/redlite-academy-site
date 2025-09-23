export default function Sponsors(){
  return (<section className="space-y-6"><h3 className="text-xl font-bold">Sponsors</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({length:8}).map((_,i)=>(<a key={i} href="#" className="border rounded-xl p-6 flex items-center justify-center hover:shadow">
        <span className="text-sm text-gray-500">Sponsor #{i+1}</span></a>))}
    </div></section>);
}