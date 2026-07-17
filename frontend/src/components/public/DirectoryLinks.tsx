type Directory = {
  name: string;
  url: string;
  description: string;
};

const directories: Directory[] = [
  {
    name: "BlogHub",
    url: "https://bloghub.app",
    description: "Product Hunt–style discovery platform for blogs and publications.",
  },
  {
    name: "Idea Kiln",
    url: "https://ideakiln.com",
    description: "Directory of new products and startup ideas.",
  },
  {
    name: "EarlyHunt",
    url: "https://earlyhunt.com",
    description: "Launch directory for early-stage products.",
  },
  {
    name: "Huzzler",
    url: "https://huzzler.so",
    description: "Community and directory for indie makers and their products.",
  },
];

export default function DirectoryLinks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
          Directories
        </p>
        <h2 className="text-2xl font-semibold text-gray-900">
          Find Blog2Video on these directories
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
          Discovery platforms and launch directories where you can find and list
          your product.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {directories.map((directory) => (
            <a
              key={directory.url}
              href={directory.url}
              target="_blank"
              rel="noopener"
              className="block rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <p className="text-sm font-semibold text-gray-900">{directory.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                {directory.description}
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
