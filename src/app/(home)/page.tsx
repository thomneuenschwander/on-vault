import Link from 'next/link';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? 'docs';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">on-vault</h1>
      <p>
        <Link href={`/${basePath}`} className="font-medium underline">
          Browse notes
        </Link>
      </p>
    </div>
  );
}
