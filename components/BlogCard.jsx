export default function BlogCard({ title, excerpt, date, category, slug }) {
  return (
    <a
      href={`/blog/${slug}`}
      className="block bg-card rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition"
    >
      <div className="p-6">
        <span className="text-sm text-accent font-semibold">{category}</span>
        <h3 className="text-xl font-bold mt-2">{title}</h3>
        <p className="text-muted mt-2">{excerpt}</p>
        <p className="text-muted text-sm mt-4">{new Date(date).toLocaleDateString()}</p>
      </div>
    </a>
  );
}
