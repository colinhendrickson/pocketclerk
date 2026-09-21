function Proof({ theme }: { theme: string }) {
  return (
    <section
      data-theme={theme}
      className="flex-1 bg-base-100 text-base-content p-10 flex flex-col gap-6"
    >
      <p className="text-sm font-bold opacity-70">theme: {theme}</p>
      <h1 className="text-5xl font-extrabold">Welcome, Maya!</h1>
      <p className="text-8xl font-extrabold tabular">$3.00</p>
      <button className="btn btn-primary min-h-[60px] text-3xl font-extrabold">
        Start classroom order
      </button>
      <button className="btn bg-base-100 border-base-300 min-h-[60px] text-2xl font-extrabold">
        Today’s orders
      </button>
    </section>
  );
}

export default function Home() {
  return (
    <main className="flex-1 flex flex-col lg:flex-row">
      <Proof theme="pocketclerk" />
      <Proof theme="sample" />
    </main>
  );
}
