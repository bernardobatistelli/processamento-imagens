"use client"
import ImageProcessor from "@/components/image-processor"

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Sistema de Processamento de Imagens</h1>
        <ImageProcessor />
      </div>
    </main>
  )
}

