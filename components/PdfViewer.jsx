// src/components/PdfViewer.jsx
export default function PdfViewer({ title, pdfUrl }) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-semibold mb-3 text-primary">{title}</h2>
      <object
        data={pdfUrl}
        type="application/pdf"
        className="w-full h-[720px] border rounded-lg"
      >
        <p className="p-4">
          Unable to display PDF.
          {" "}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
            Click here to open {title}
          </a>.
        </p>
      </object>
    </div>
  );
}
