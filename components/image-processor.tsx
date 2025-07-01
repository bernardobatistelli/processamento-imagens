"use client"

import type React from "react"
import * as UTIF from "utif"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeftRight,
  ArrowUpDown,
  BarChart,
  Contrast,
  Divide,
  Download,
  Filter,
  ImageOff,
  Layers,
  Minus,
  Plus,
  Sliders,
  SunMoon,
  Wand2,
  X,
} from "lucide-react"
import { useRef, useState } from "react"

// Tipos para os kernels de convolução
interface Kernel {
  name: string
  matrix: number[][]
  divisor?: number
}

const ImageProcessor = () => {
  // Estados para as imagens
  const [image1, setImage1] = useState<HTMLImageElement | null>(null)
  const [image2, setImage2] = useState<HTMLImageElement | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)

  // Estados para os parâmetros
  const [constantValue, setConstantValue] = useState(50)
  const [blendFactor, setBlendFactor] = useState(0.5)
  const [thresholdValue, setThresholdValue] = useState(127)
  const [kernelSize, setKernelSize] = useState(3)
  const [orderValue, setOrderValue] = useState(4)
  const [sigmaValue, setSigmaValue] = useState(1.0)

  // Estado para a aba ativa
  const [activeTab, setActiveTab] = useState("arithmetic")

  // Referências para os canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const resultCanvasRef = useRef<HTMLCanvasElement>(null)
  const histogramCanvasRef = useRef<HTMLCanvasElement>(null)

  // Estado para o histograma
  const [showHistogram, setShowHistogram] = useState(false)

  // Kernels predefinidos para filtros
  const kernels: { [key: string]: Kernel } = {
    prewittX: {
      name: "Prewitt X",
      matrix: [
        [-1, 0, 1],
        [-1, 0, 1],
        [-1, 0, 1],
      ],
    },
    prewittY: {
      name: "Prewitt Y",
      matrix: [
        [-1, -1, -1],
        [0, 0, 0],
        [1, 1, 1],
      ],
    },
    sobelX: {
      name: "Sobel X",
      matrix: [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1],
      ],
    },
    sobelY: {
      name: "Sobel Y",
      matrix: [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1],
      ],
    },
    laplacian: {
      name: "Laplaciano",
      matrix: [
        [0, 1, 0],
        [1, -4, 1],
        [0, 1, 0],
      ],
    },
    gaussian3x3: {
      name: "Gaussiano 3x3",
      matrix: [
        [1, 2, 1],
        [2, 4, 2],
        [1, 2, 1],
      ],
      divisor: 16,
    },
  }

  // Carregar imagem a partir do input de arquivo
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, imageNumber: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check if the file is a TIFF/TIF file
    const isTiff = file.type === 'image/tiff' || file.type === 'image/tif' || 
                   file.name.toLowerCase().endsWith('.tif') || 
                   file.name.toLowerCase().endsWith('.tiff')

    if (isTiff) {
      // Handle TIFF files using UTIF library
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          if (!arrayBuffer) return

          // Parse the TIFF file
          const ifds = UTIF.decode(arrayBuffer)
          if (ifds.length === 0) {
            console.error('No images found in TIFF file')
            return
          }

          // Use the first image
          const firstImage = ifds[0]
          UTIF.decodeImage(arrayBuffer, firstImage)

          // Create canvas to convert TIFF to displayable format
          const canvas = document.createElement('canvas')
          canvas.width = firstImage.width
          canvas.height = firstImage.height
          const ctx = canvas.getContext('2d')
          
          if (!ctx) {
            console.error('Failed to get canvas context')
            return
          }

          // Create ImageData from the decoded TIFF
          const imageData = new ImageData(
            new Uint8ClampedArray(UTIF.toRGBA8(firstImage)),
            firstImage.width,
            firstImage.height
          )
          
          ctx.putImageData(imageData, 0, 0)

          // Convert canvas to data URL and create image
          const img = new Image()
          img.crossOrigin = "anonymous"
          img.onload = () => {
            if (imageNumber === 1) {
              setImage1(img)
            } else {
              setImage2(img)
            }
          }
          img.src = canvas.toDataURL('image/png')

        } catch (error) {
          console.error('Error processing TIFF file:', error)
          alert('Error processing TIFF file. Please make sure it\'s a valid TIFF image.')
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      // Handle regular image files (PNG, JPEG, BMP)
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => {
          if (imageNumber === 1) {
            setImage1(img)
          } else {
            setImage2(img)
          }
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    }
  }

  // Remover imagem
  const removeImage = (imageNumber: number) => {
    if (imageNumber === 1) {
      setImage1(null)
    } else {
      setImage2(null)
    }
    // Limpar resultado ao remover imagens
    setResultImage(null)
    setShowHistogram(false)
  }

  // Obter dados da imagem a partir do canvas
  const getImageData = (image: HTMLImageElement) => {
    if (!canvasRef.current) return null

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return null

    canvas.width = image.width
    canvas.height = image.height
    ctx.drawImage(image, 0, 0)

    return ctx.getImageData(0, 0, image.width, image.height)
  }

  // Exibir imagem resultante no canvas
  const displayResultImage = (imageData: ImageData) => {
    if (!resultCanvasRef.current) return

    const canvas = resultCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)

    setResultImage(canvas.toDataURL())
  }

  // Limitar valor entre 0 e 255
  const clamp = (value: number) => Math.min(255, Math.max(0, value))

  // Calcular e exibir histograma
  const displayHistogram = (imageData: ImageData) => {
    if (!histogramCanvasRef.current) return

    const canvas = histogramCanvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Dimensões do canvas
    const width = 256
    const height = 150
    canvas.width = width
    canvas.height = height

    // Limpar canvas
    ctx.fillStyle = "#f8f9fa"
    ctx.fillRect(0, 0, width, height)

    // Calcular histograma
    const histogram = new Array(256).fill(0)

    for (let i = 0; i < imageData.data.length; i += 4) {
      // Converter para escala de cinza
      const gray = Math.round(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
      histogram[gray]++
    }

    // Encontrar valor máximo para normalização
    const maxValue = Math.max(...histogram)

    // Desenhar histograma
    ctx.beginPath()
    ctx.strokeStyle = "#3b82f6"
    ctx.lineWidth = 1

    for (let i = 0; i < 256; i++) {
      const x = i
      const y = height - (histogram[i] / maxValue) * height

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Desenhar eixos
    ctx.strokeStyle = "#64748b"
    ctx.beginPath()
    ctx.moveTo(0, height - 1)
    ctx.lineTo(width, height - 1)
    ctx.stroke()

    setShowHistogram(true)
  }

  // Equalizar histograma
  const equalizeHistogram = (imageData: ImageData) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height
    const totalPixels = width * height

    // Calcular histograma para cada canal
    const histogramR = new Array(256).fill(0)
    const histogramG = new Array(256).fill(0)
    const histogramB = new Array(256).fill(0)

    for (let i = 0; i < pixels.length; i += 4) {
      histogramR[pixels[i]]++
      histogramG[pixels[i + 1]]++
      histogramB[pixels[i + 2]]++
    }

    // Calcular CDF (Função de Distribuição Cumulativa)
    const cdfR = new Array(256).fill(0)
    const cdfG = new Array(256).fill(0)
    const cdfB = new Array(256).fill(0)

    cdfR[0] = histogramR[0]
    cdfG[0] = histogramG[0]
    cdfB[0] = histogramB[0]

    for (let i = 1; i < 256; i++) {
      cdfR[i] = cdfR[i - 1] + histogramR[i]
      cdfG[i] = cdfG[i - 1] + histogramG[i]
      cdfB[i] = cdfB[i - 1] + histogramB[i]
    }

    // Normalizar CDF
    const normalizedCdfR = cdfR.map((v) => Math.round((v / totalPixels) * 255))
    const normalizedCdfG = cdfG.map((v) => Math.round((v / totalPixels) * 255))
    const normalizedCdfB = cdfB.map((v) => Math.round((v / totalPixels) * 255))

    // Aplicar equalização
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = normalizedCdfR[pixels[i]]
      pixels[i + 1] = normalizedCdfG[pixels[i + 1]]
      pixels[i + 2] = normalizedCdfB[pixels[i + 2]]
    }

    return imageData
  }

  // Aplicar limiarização (thresholding)
  const applyThreshold = (imageData: ImageData, threshold: number) => {
    const pixels = imageData.data

    for (let i = 0; i < pixels.length; i += 4) {
      // Converter para escala de cinza
      const gray = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])

      // Aplicar limiar
      const value = gray > threshold ? 255 : 0

      pixels[i] = value
      pixels[i + 1] = value
      pixels[i + 2] = value
    }

    return imageData
  }

  // Aplicar convolução
  const applyConvolution = (imageData: ImageData, kernel: number[][], divisor = 1) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const kernelSize = kernel.length
    const kernelRadius = Math.floor(kernelSize / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0
        let sumG = 0
        let sumB = 0

        // Aplicar kernel
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx - kernelRadius))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky - kernelRadius))

            const pixelIndex = (pixelY * width + pixelX) * 4
            const kernelValue = kernel[ky][kx]

            sumR += pixels[pixelIndex] * kernelValue
            sumG += pixels[pixelIndex + 1] * kernelValue
            sumB += pixels[pixelIndex + 2] * kernelValue
          }
        }

        const outputIndex = (y * width + x) * 4

        // Aplicar divisor e limitar valores
        output[outputIndex] = clamp(sumR / divisor)
        output[outputIndex + 1] = clamp(sumG / divisor)
        output[outputIndex + 2] = clamp(sumB / divisor)
        output[outputIndex + 3] = pixels[outputIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Aplicar filtro de mediana
  const applyMedianFilter = (imageData: ImageData, size: number) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const radius = Math.floor(size / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const valuesR = []
        const valuesG = []
        const valuesB = []

        // Coletar valores da vizinhança
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky))

            const pixelIndex = (pixelY * width + pixelX) * 4

            valuesR.push(pixels[pixelIndex])
            valuesG.push(pixels[pixelIndex + 1])
            valuesB.push(pixels[pixelIndex + 2])
          }
        }

        // Ordenar valores
        valuesR.sort((a, b) => a - b)
        valuesG.sort((a, b) => a - b)
        valuesB.sort((a, b) => a - b)

        // Obter valor mediano
        const medianIndex = Math.floor(valuesR.length / 2)

        const outputIndex = (y * width + x) * 4

        output[outputIndex] = valuesR[medianIndex]
        output[outputIndex + 1] = valuesG[medianIndex]
        output[outputIndex + 2] = valuesB[medianIndex]
        output[outputIndex + 3] = pixels[outputIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Aplicar filtro de ordem
  const applyOrderFilter = (imageData: ImageData, size: number, order: number) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const radius = Math.floor(size / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const valuesR = []
        const valuesG = []
        const valuesB = []

        // Coletar valores da vizinhança
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky))

            const pixelIndex = (pixelY * width + pixelX) * 4

            valuesR.push(pixels[pixelIndex])
            valuesG.push(pixels[pixelIndex + 1])
            valuesB.push(pixels[pixelIndex + 2])
          }
        }

        // Ordenar valores
        valuesR.sort((a, b) => a - b)
        valuesG.sort((a, b) => a - b)
        valuesB.sort((a, b) => a - b)

        // Obter valor de ordem
        const orderIndex = Math.min(valuesR.length - 1, Math.max(0, order))

        const outputIndex = (y * width + x) * 4

        output[outputIndex] = valuesR[orderIndex]
        output[outputIndex + 1] = valuesG[orderIndex]
        output[outputIndex + 2] = valuesB[orderIndex]
        output[outputIndex + 3] = pixels[outputIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Aplicar filtro MAX
  const applyMaxFilter = (imageData: ImageData, size: number) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const radius = Math.floor(size / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxR = 0
        let maxG = 0
        let maxB = 0

        // Encontrar valores máximos na vizinhança
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky))

            const pixelIndex = (pixelY * width + pixelX) * 4

            maxR = Math.max(maxR, pixels[pixelIndex])
            maxG = Math.max(maxG, pixels[pixelIndex + 1])
            maxB = Math.max(maxB, pixels[pixelIndex + 2])
          }
        }

        const outputIndex = (y * width + x) * 4

        output[outputIndex] = maxR
        output[outputIndex + 1] = maxG
        output[outputIndex + 2] = maxB
        output[outputIndex + 3] = pixels[outputIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Aplicar filtro MIN
  const applyMinFilter = (imageData: ImageData, size: number) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const radius = Math.floor(size / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minR = 255
        let minG = 255
        let minB = 255

        // Encontrar valores mínimos na vizinhança
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky))

            const pixelIndex = (pixelY * width + pixelX) * 4

            minR = Math.min(minR, pixels[pixelIndex])
            minG = Math.min(minG, pixels[pixelIndex + 1])
            minB = Math.min(minB, pixels[pixelIndex + 2])
          }
        }

        const outputIndex = (y * width + x) * 4

        output[outputIndex] = minR
        output[outputIndex + 1] = minG
        output[outputIndex + 2] = minB
        output[outputIndex + 3] = pixels[outputIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Aplicar filtro MEAN (média)
  const applyMeanFilter = (imageData: ImageData, size: number) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const radius = Math.floor(size / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sumR = 0
        let sumG = 0
        let sumB = 0
        let count = 0

        // Calcular soma na vizinhança
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const pixelX = Math.min(width - 1, Math.max(0, x + kx))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky))

            const pixelIndex = (pixelY * width + pixelX) * 4

            sumR += pixels[pixelIndex]
            sumG += pixels[pixelIndex + 1]
            sumB += pixels[pixelIndex + 2]
            count++
          }
        }

        const outputIndex = (y * width + x) * 4

        output[outputIndex] = Math.round(sumR / count)
        output[outputIndex + 1] = Math.round(sumG / count)
        output[outputIndex + 2] = Math.round(sumB / count)
        output[outputIndex + 3] = pixels[outputIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Aplicar filtro de suavização conservativa
  const applyConservativeFilter = (imageData: ImageData, size: number) => {
    const pixels = imageData.data
    const width = imageData.width
    const height = imageData.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)

    const radius = Math.floor(size / 2)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const centerIndex = (y * width + x) * 4

        let minR = 255,
          maxR = 0
        let minG = 255,
          maxG = 0
        let minB = 255,
          maxB = 0

        // Encontrar valores mínimos e máximos na vizinhança
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            // Pular o pixel central
            if (kx === 0 && ky === 0) continue

            const pixelX = Math.min(width - 1, Math.max(0, x + kx))
            const pixelY = Math.min(height - 1, Math.max(0, y + ky))

            const pixelIndex = (pixelY * width + pixelX) * 4

            minR = Math.min(minR, pixels[pixelIndex])
            maxR = Math.max(maxR, pixels[pixelIndex])

            minG = Math.min(minG, pixels[pixelIndex + 1])
            maxG = Math.max(maxG, pixels[pixelIndex + 1])

            minB = Math.min(minB, pixels[pixelIndex + 2])
            maxB = Math.max(maxB, pixels[pixelIndex + 2])
          }
        }

        // Aplicar filtro conservativo
        output[centerIndex] = Math.min(maxR, Math.max(minR, pixels[centerIndex]))
        output[centerIndex + 1] = Math.min(maxG, Math.max(minG, pixels[centerIndex + 1]))
        output[centerIndex + 2] = Math.min(maxB, Math.max(minB, pixels[centerIndex + 2]))
        output[centerIndex + 3] = pixels[centerIndex + 3] // Manter alpha
      }
    }

    // Atualizar pixels
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = output[i]
    }

    return imageData
  }

  // Criar kernel gaussiano
  const createGaussianKernel = (size: number, sigma: number) => {
    const kernel: number[][] = []
    const radius = Math.floor(size / 2)
    let sum = 0

    // Calcular valores do kernel
    for (let y = -radius; y <= radius; y++) {
      const row: number[] = []
      for (let x = -radius; x <= radius; x++) {
        const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma))
        row.push(value)
        sum += value
      }
      kernel.push(row)
    }

    // Normalizar kernel
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        kernel[y][x] /= sum
      }
    }

    return kernel
  }

  // Aplicar filtro gaussiano
  const applyGaussianFilter = (imageData: ImageData, size: number, sigma: number) => {
    const kernel = createGaussianKernel(size, sigma)
    return applyConvolution(imageData, kernel, 1)
  }

  // Aplicar operações morfológicas
  const applyMorphologicalOperation = (imageData: ImageData, operation: string, size: number) => {
    // Primeiro, converter para imagem binária
    const binaryImage = applyThreshold(
      new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height),
      127,
    )

    const pixels = binaryImage.data
    const width = binaryImage.width
    const height = binaryImage.height

    // Criar cópia dos pixels para não afetar os cálculos
    const output = new Uint8ClampedArray(pixels.length)
    for (let i = 0; i < pixels.length; i++) {
      output[i] = pixels[i]
    }

    const radius = Math.floor(size / 2)

    // Criar elemento estruturante (disco)
    const structuringElement: boolean[][] = []
    for (let y = 0; y < size; y++) {
      const row: boolean[] = []
      for (let x = 0; x < size; x++) {
        // Distância do centro
        const dx = x - radius
        const dy = y - radius
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Incluir no elemento estruturante se estiver dentro do raio
        row.push(distance <= radius)
      }
      structuringElement.push(row)
    }

    // Aplicar operação morfológica
    switch (operation) {
      case "dilate":
        // Dilatação: se qualquer pixel no elemento estruturante for 255, o pixel de saída é 255
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let result = 0

            for (let ky = 0; ky < size; ky++) {
              for (let kx = 0; kx < size; kx++) {
                if (!structuringElement[ky][kx]) continue

                const pixelX = Math.min(width - 1, Math.max(0, x + kx - radius))
                const pixelY = Math.min(height - 1, Math.max(0, y + ky - radius))

                const pixelIndex = (pixelY * width + pixelX) * 4

                if (pixels[pixelIndex] === 255) {
                  result = 255
                  break
                }
              }
              if (result === 255) break
            }

            const outputIndex = (y * width + x) * 4
            output[outputIndex] = output[outputIndex + 1] = output[outputIndex + 2] = result
          }
        }
        break

      case "erode":
        // Erosão: se qualquer pixel no elemento estruturante for 0, o pixel de saída é 0
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let result = 255

            for (let ky = 0; ky < size; ky++) {
              for (let kx = 0; kx < size; kx++) {
                if (!structuringElement[ky][kx]) continue

                const pixelX = Math.min(width - 1, Math.max(0, x + kx - radius))
                const pixelY = Math.min(height - 1, Math.max(0, y + ky - radius))

                const pixelIndex = (pixelY * width + pixelX) * 4

                if (pixels[pixelIndex] === 0) {
                  result = 0
                  break
                }
              }
              if (result === 0) break
            }

            const outputIndex = (y * width + x) * 4
            output[outputIndex] = output[outputIndex + 1] = output[outputIndex + 2] = result
          }
        }
        break

      case "open":
        // Abertura: erosão seguida de dilatação
        const erodedImage = applyMorphologicalOperation(
          new ImageData(new Uint8ClampedArray(pixels), width, height),
          "erode",
          size,
        )
        return applyMorphologicalOperation(erodedImage, "dilate", size)

      case "close":
        // Fechamento: dilatação seguida de erosão
        const dilatedImage = applyMorphologicalOperation(
          new ImageData(new Uint8ClampedArray(pixels), width, height),
          "dilate",
          size,
        )
        return applyMorphologicalOperation(dilatedImage, "erode", size)

      case "contour":
        // Contorno: imagem original menos a erosão
        const erodedContourImage = applyMorphologicalOperation(
          new ImageData(new Uint8ClampedArray(pixels), width, height),
          "erode",
          size,
        )

        for (let i = 0; i < pixels.length; i += 4) {
          output[i] = output[i + 1] = output[i + 2] = pixels[i] === 255 && erodedContourImage.data[i] === 0 ? 255 : 0
        }
        break
    }

    // Atualizar pixels
    for (let i = 0; i < imageData.data.length; i++) {
      imageData.data[i] = output[i]
    }

    return imageData
  }

  // Operações de processamento de imagem
  const processImages = (operation: string) => {
    if (!image1) return

    const imageData1 = getImageData(image1)
    if (!imageData1) return

    let resultData = new ImageData(new Uint8ClampedArray(imageData1.data), imageData1.width, imageData1.height)

    const imageData2 = image2 ? getImageData(image2) : null

    // Processar imagem com base na operação selecionada
    switch (operation) {
      // Operações aritméticas
      case "add":
        if (!imageData2) return
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] + imageData2.data[i])
          resultData.data[i + 1] = clamp(imageData1.data[i + 1] + imageData2.data[i + 1])
          resultData.data[i + 2] = clamp(imageData1.data[i + 2] + imageData2.data[i + 2])
          resultData.data[i + 3] = 255
        }
        break

      case "addConstant":
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] + constantValue)
          resultData.data[i + 1] = clamp(imageData1.data[i + 1] + constantValue)
          resultData.data[i + 2] = clamp(imageData1.data[i + 2] + constantValue)
          resultData.data[i + 3] = 255
        }
        break

      case "subtract":
        if (!imageData2) return
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] - imageData2.data[i])
          resultData.data[i + 1] = clamp(imageData1.data[i + 1] - imageData2.data[i + 1])
          resultData.data[i + 2] = clamp(imageData1.data[i + 2] - imageData2.data[i + 2])
          resultData.data[i + 3] = 255
        }
        break

      case "subtractConstant":
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] - constantValue)
          resultData.data[i + 1] = clamp(imageData1.data[i + 1] - constantValue)
          resultData.data[i + 2] = clamp(imageData1.data[i + 2] - constantValue)
          resultData.data[i + 3] = 255
        }
        break

      case "multiply":
        const factor = constantValue / 50
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] * factor)
          resultData.data[i + 1] = clamp(imageData1.data[i + 1] * factor)
          resultData.data[i + 2] = clamp(imageData1.data[i + 2] * factor)
          resultData.data[i + 3] = 255
        }
        break

      case "divide":
        const divisor = constantValue / 50
        if (divisor === 0) return
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] / divisor)
          resultData.data[i + 1] = clamp(imageData1.data[i + 1] / divisor)
          resultData.data[i + 2] = clamp(imageData1.data[i + 2] / divisor)
          resultData.data[i + 3] = 255
        }
        break

      case "blend":
        if (!imageData2) return
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(imageData1.data[i] * blendFactor + imageData2.data[i] * (1 - blendFactor))
          resultData.data[i + 1] = clamp(
            imageData1.data[i + 1] * blendFactor + imageData2.data[i + 1] * (1 - blendFactor),
          )
          resultData.data[i + 2] = clamp(
            imageData1.data[i + 2] * blendFactor + imageData2.data[i + 2] * (1 - blendFactor),
          )
          resultData.data[i + 3] = 255
        }
        break

      case "average":
        if (!imageData2) return
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp((imageData1.data[i] + imageData2.data[i]) / 2)
          resultData.data[i + 1] = clamp((imageData1.data[i + 1] + imageData2.data[i + 1]) / 2)
          resultData.data[i + 2] = clamp((imageData1.data[i + 2] + imageData2.data[i + 2]) / 2)
          resultData.data[i + 3] = 255
        }
        break

      case "difference":
        if (!imageData2) return
        for (let i = 0; i < imageData1.data.length; i += 4) {
          resultData.data[i] = clamp(Math.abs(imageData1.data[i] - imageData2.data[i]))
          resultData.data[i + 1] = clamp(Math.abs(imageData1.data[i + 1] - imageData2.data[i + 1]))
          resultData.data[i + 2] = clamp(Math.abs(imageData1.data[i + 2] - imageData2.data[i + 2]))
          resultData.data[i + 3] = 255
        }
        break

      // Operações lógicas (para imagens binárias)
      case "and":
        if (!imageData2) return
        // Primeiro, converter para imagens binárias
        const binaryImage1 = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData1.data), imageData1.width, imageData1.height),
          127,
        )
        const binaryImage2 = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData2.data), imageData2.width, imageData2.height),
          127,
        )

        for (let i = 0; i < binaryImage1.data.length; i += 4) {
          const value = binaryImage1.data[i] === 255 && binaryImage2.data[i] === 255 ? 255 : 0
          resultData.data[i] = resultData.data[i + 1] = resultData.data[i + 2] = value
          resultData.data[i + 3] = 255
        }
        break

      case "or":
        if (!imageData2) return
        // Primeiro, converter para imagens binárias
        const binaryOrImage1 = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData1.data), imageData1.width, imageData1.height),
          127,
        )
        const binaryOrImage2 = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData2.data), imageData2.width, imageData2.height),
          127,
        )

        for (let i = 0; i < binaryOrImage1.data.length; i += 4) {
          const value = binaryOrImage1.data[i] === 255 || binaryOrImage2.data[i] === 255 ? 255 : 0
          resultData.data[i] = resultData.data[i + 1] = resultData.data[i + 2] = value
          resultData.data[i + 3] = 255
        }
        break

      case "not":
        // Primeiro, converter para imagem binária
        const binaryNotImage = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData1.data), imageData1.width, imageData1.height),
          127,
        )

        for (let i = 0; i < binaryNotImage.data.length; i += 4) {
          const value = binaryNotImage.data[i] === 255 ? 0 : 255
          resultData.data[i] = resultData.data[i + 1] = resultData.data[i + 2] = value
          resultData.data[i + 3] = 255
        }
        break

      case "xor":
        if (!imageData2) return
        // Primeiro, converter para imagens binárias
        const binaryXorImage1 = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData1.data), imageData1.width, imageData1.height),
          127,
        )
        const binaryXorImage2 = applyThreshold(
          new ImageData(new Uint8ClampedArray(imageData2.data), imageData2.width, imageData2.height),
          127,
        )

        for (let i = 0; i < binaryXorImage1.data.length; i += 4) {
          const value = (binaryXorImage1.data[i] === 255) !== (binaryXorImage2.data[i] === 255) ? 255 : 0
          resultData.data[i] = resultData.data[i + 1] = resultData.data[i + 2] = value
          resultData.data[i + 3] = 255
        }
        break

      // Transformações
      case "grayscale":
        for (let i = 0; i < imageData1.data.length; i += 4) {
          const gray = Math.round(
            0.299 * imageData1.data[i] + 0.587 * imageData1.data[i + 1] + 0.114 * imageData1.data[i + 2],
          )
          resultData.data[i] = resultData.data[i + 1] = resultData.data[i + 2] = gray
          resultData.data[i + 3] = 255
        }
        break

      case "flipHorizontal":
        for (let y = 0; y < imageData1.height; y++) {
          for (let x = 0; x < imageData1.width / 2; x++) {
            const pos1 = (y * imageData1.width + x) * 4
            const pos2 = (y * imageData1.width + (imageData1.width - x - 1)) * 4

            for (let i = 0; i < 4; i++) {
              const temp = resultData.data[pos1 + i]
              resultData.data[pos1 + i] = resultData.data[pos2 + i]
              resultData.data[pos2 + i] = temp
            }
          }
        }
        break

      case "flipVertical":
        for (let x = 0; x < imageData1.width; x++) {
          for (let y = 0; y < imageData1.height / 2; y++) {
            const pos1 = (y * imageData1.width + x) * 4
            const pos2 = ((imageData1.height - y - 1) * imageData1.width + x) * 4

            for (let i = 0; i < 4; i++) {
              const temp = resultData.data[pos1 + i]
              resultData.data[pos1 + i] = resultData.data[pos2 + i]
              resultData.data[pos2 + i] = temp
            }
          }
        }
        break

      // Histograma e limiarização
      case "equalize":
        resultData = equalizeHistogram(resultData)
        break

      case "threshold":
        resultData = applyThreshold(resultData, thresholdValue)
        break

      // Filtros espaciais
      case "median":
        resultData = applyMedianFilter(resultData, kernelSize)
        break

      case "max":
        resultData = applyMaxFilter(resultData, kernelSize)
        break

      case "min":
        resultData = applyMinFilter(resultData, kernelSize)
        break

      case "mean":
        resultData = applyMeanFilter(resultData, kernelSize)
        break

      case "order":
        resultData = applyOrderFilter(resultData, kernelSize, orderValue)
        break

      case "conservative":
        resultData = applyConservativeFilter(resultData, kernelSize)
        break

      case "gaussian":
        resultData = applyGaussianFilter(resultData, kernelSize, sigmaValue)
        break

      // Detecção de bordas
      case "prewittX":
        resultData = applyConvolution(resultData, kernels.prewittX.matrix)
        break

      case "prewittY":
        resultData = applyConvolution(resultData, kernels.prewittY.matrix)
        break

      case "sobelX":
        resultData = applyConvolution(resultData, kernels.sobelX.matrix)
        break

      case "sobelY":
        resultData = applyConvolution(resultData, kernels.sobelY.matrix)
        break

      case "laplacian":
        resultData = applyConvolution(resultData, kernels.laplacian.matrix)
        break

      // Operações morfológicas
      case "dilate":
      case "erode":
      case "open":
      case "close":
      case "contour":
        resultData = applyMorphologicalOperation(resultData, operation, kernelSize)
        break

      default:
        return
    }

    displayResultImage(resultData)

    // Exibir histograma para operações relevantes
    if (["grayscale", "equalize", "threshold"].includes(operation)) {
      displayHistogram(resultData)
    } else {
      setShowHistogram(false)
    }
  }

  // Salvar imagem resultante
  const saveResultImage = () => {
    if (!resultImage) return

    const link = document.createElement("a")
    link.download = "processed-image.png"
    link.href = resultImage
    link.click()
  }

  // Limpar imagem resultante
  const clearResultImage = () => {
    setResultImage(null)
    setShowHistogram(false)
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Imagens de entrada e resultado */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Imagem 1</CardTitle>
            <CardDescription>Selecione a primeira imagem</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <input
                type="file"
                accept="image/png, image/jpeg, image/bmp, image/tiff, image/tif, .tif, .tiff"
                onChange={(e) => handleImageUpload(e, 1)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:bg-primary/90"
              />
              {image1 ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-md border">
                  <img src={image1.src || "/placeholder.svg"} alt="Imagem 1" className="object-contain w-full h-full" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => removeImage(1)}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-square w-full rounded-md border bg-gray-100">
                  <p className="text-gray-400">Nenhuma imagem</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Imagem 2</CardTitle>
            <CardDescription>Selecione a segunda imagem (para operações que requerem duas imagens)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <input
                type="file"
                accept="image/png, image/jpeg, image/bmp, image/tiff, image/tif, .tif, .tiff"
                onChange={(e) => handleImageUpload(e, 2)}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:bg-primary/90"
              />
              {image2 ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-md border">
                  <img src={image2.src || "/placeholder.svg"} alt="Imagem 2" className="object-contain w-full h-full" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => removeImage(2)}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-square w-full rounded-md border bg-gray-100">
                  <p className="text-gray-400">Nenhuma imagem</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>Imagem resultante após processamento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {resultImage ? (
                <div className="relative aspect-square w-full overflow-hidden rounded-md border">
                  <img
                    src={resultImage || "/placeholder.svg"}
                    alt="Imagem Resultante"
                    className="object-contain w-full h-full"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center aspect-square w-full rounded-md border bg-gray-100">
                  <p className="text-gray-400">Nenhum resultado</p>
                </div>
              )}

              {showHistogram && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium mb-2">Histograma</h3>
                  <div className="border rounded-md p-2">
                    <canvas ref={histogramCanvasRef} className="w-full h-[150px]" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={saveResultImage} disabled={!resultImage} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Salvar Imagem
            </Button>
            <Button onClick={clearResultImage} disabled={!resultImage} variant="outline" className="flex-1">
              <ImageOff className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Operações */}
      <Card>
        <CardHeader>
          <CardTitle>Operações</CardTitle>
          <CardDescription>Selecione a operação a ser aplicada na imagem</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="arithmetic" onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-4">
              <TabsTrigger value="arithmetic">
                <Plus className="h-4 w-4 mr-2" />
                Aritméticas
              </TabsTrigger>
              <TabsTrigger value="transform">
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                Transformações
              </TabsTrigger>
              <TabsTrigger value="histogram">
                <BarChart className="h-4 w-4 mr-2" />
                Histograma
              </TabsTrigger>
              <TabsTrigger value="filters">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </TabsTrigger>
              <TabsTrigger value="morphology">
                <Layers className="h-4 w-4 mr-2" />
                Morfologia
              </TabsTrigger>
            </TabsList>

            {/* Operações Aritméticas */}
            <TabsContent value="arithmetic">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button onClick={() => processImages("add")} disabled={!image1 || !image2}>
                  <Plus className="mr-2 h-4 w-4" />
                  Somar Imagens
                </Button>

                <Button onClick={() => processImages("addConstant")} disabled={!image1}>
                  <SunMoon className="mr-2 h-4 w-4" />
                  Aumentar Brilho (+{constantValue})
                </Button>

                <Button onClick={() => processImages("subtract")} disabled={!image1 || !image2}>
                  <Minus className="mr-2 h-4 w-4" />
                  Subtrair Imagens
                </Button>

                <Button onClick={() => processImages("subtractConstant")} disabled={!image1}>
                  <SunMoon className="mr-2 h-4 w-4" />
                  Diminuir Brilho (-{constantValue})
                </Button>

                <Button onClick={() => processImages("multiply")} disabled={!image1}>
                  <X className="mr-2 h-4 w-4" />
                  Multiplicar por {constantValue / 50}x
                </Button>

                <Button onClick={() => processImages("divide")} disabled={!image1 || constantValue === 0}>
                  <Divide className="mr-2 h-4 w-4" />
                  Dividir por {constantValue / 50}x
                </Button>

                <Button onClick={() => processImages("difference")} disabled={!image1 || !image2}>
                  <ImageOff className="mr-2 h-4 w-4" />
                  Diferença entre Imagens
                </Button>

                <Button onClick={() => processImages("blend")} disabled={!image1 || !image2}>
                  <Sliders className="mr-2 h-4 w-4" />
                  Combinação Linear (Blending)
                </Button>

                <Button onClick={() => processImages("average")} disabled={!image1 || !image2}>
                  <Sliders className="mr-2 h-4 w-4" />
                  Média de Imagens
                </Button>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Valor Constante: {constantValue}</Label>
                  <Slider
                    value={[constantValue]}
                    min={0}
                    max={255}
                    step={1}
                    onValueChange={(value) => setConstantValue(value[0])}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Fator de Blending: {blendFactor.toFixed(2)}</Label>
                  <Slider
                    value={[blendFactor * 100]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(value) => setBlendFactor(value[0] / 100)}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Operações Lógicas (Imagens Binárias)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Button onClick={() => processImages("and")} disabled={!image1 || !image2}>
                    AND
                  </Button>

                  <Button onClick={() => processImages("or")} disabled={!image1 || !image2}>
                    OR
                  </Button>

                  <Button onClick={() => processImages("not")} disabled={!image1}>
                    NOT
                  </Button>

                  <Button onClick={() => processImages("xor")} disabled={!image1 || !image2}>
                    XOR
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Transformações */}
            <TabsContent value="transform">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button onClick={() => processImages("grayscale")} disabled={!image1}>
                  <Contrast className="mr-2 h-4 w-4" />
                  Converter para Escala de Cinza
                </Button>

                <Button onClick={() => processImages("flipHorizontal")} disabled={!image1}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  Inverter Horizontalmente
                </Button>

                <Button onClick={() => processImages("flipVertical")} disabled={!image1}>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Inverter Verticalmente
                </Button>
              </div>
            </TabsContent>

            {/* Histograma */}
            <TabsContent value="histogram">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Equalização de Histograma</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Melhora o contraste da imagem redistribuindo os valores de intensidade.
                  </p>
                  <Button onClick={() => processImages("equalize")} disabled={!image1}>
                    <BarChart className="mr-2 h-4 w-4" />
                    Equalizar Histograma
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Limiarização</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Converte a imagem em preto e branco usando um valor de limiar.
                  </p>
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label>Valor de Limiar: {thresholdValue}</Label>
                      <Slider
                        value={[thresholdValue]}
                        min={0}
                        max={255}
                        step={1}
                        onValueChange={(value) => setThresholdValue(value[0])}
                        className="mt-2"
                      />
                    </div>
                    <Button onClick={() => processImages("threshold")} disabled={!image1}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Aplicar Limiarização
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Filtros */}
            <TabsContent value="filters">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Filtros Passa-Baixa</h3>
                  <p className="text-sm text-gray-500 mb-4">Suavizam a imagem, reduzindo ruídos e detalhes finos.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={() => processImages("mean")} disabled={!image1}>
                      Filtro Média
                    </Button>

                    <Button onClick={() => processImages("median")} disabled={!image1}>
                      Filtro Mediana
                    </Button>

                    <Button onClick={() => processImages("max")} disabled={!image1}>
                      Filtro Máximo
                    </Button>

                    <Button onClick={() => processImages("min")} disabled={!image1}>
                      Filtro Mínimo
                    </Button>

                    <Button onClick={() => processImages("order")} disabled={!image1}>
                      Filtro Ordem
                    </Button>

                    <Button onClick={() => processImages("conservative")} disabled={!image1}>
                      Suavização Conservativa
                    </Button>

                    <Button onClick={() => processImages("gaussian")} disabled={!image1}>
                      Filtro Gaussiano
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Filtros Passa-Alta</h3>
                  <p className="text-sm text-gray-500 mb-4">Realçam bordas e detalhes finos na imagem.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={() => processImages("prewittX")} disabled={!image1}>
                      Prewitt X
                    </Button>

                    <Button onClick={() => processImages("prewittY")} disabled={!image1}>
                      Prewitt Y
                    </Button>

                    <Button onClick={() => processImages("sobelX")} disabled={!image1}>
                      Sobel X
                    </Button>

                    <Button onClick={() => processImages("sobelY")} disabled={!image1}>
                      Sobel Y
                    </Button>

                    <Button onClick={() => processImages("laplacian")} disabled={!image1}>
                      Laplaciano
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label>
                    Tamanho do Kernel: {kernelSize}x{kernelSize}
                  </Label>
                  <Select
                    value={kernelSize.toString()}
                    onValueChange={(value) => setKernelSize(Number.parseInt(value))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3x3</SelectItem>
                      <SelectItem value="5">5x5</SelectItem>
                      <SelectItem value="7">7x7</SelectItem>
                      <SelectItem value="9">9x9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Valor de Ordem: {orderValue}</Label>
                  <Slider
                    value={[orderValue]}
                    min={0}
                    max={kernelSize * kernelSize - 1}
                    step={1}
                    onValueChange={(value) => setOrderValue(value[0])}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Sigma (Gaussiano): {sigmaValue.toFixed(1)}</Label>
                  <Slider
                    value={[sigmaValue * 10]}
                    min={1}
                    max={50}
                    step={1}
                    onValueChange={(value) => setSigmaValue(value[0] / 10)}
                    className="mt-2"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Morfologia */}
            <TabsContent value="morphology">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Operações Morfológicas</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Operações para processamento de imagens binárias baseadas na forma.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button onClick={() => processImages("dilate")} disabled={!image1}>
                      Dilatação
                    </Button>

                    <Button onClick={() => processImages("erode")} disabled={!image1}>
                      Erosão
                    </Button>

                    <Button onClick={() => processImages("open")} disabled={!image1}>
                      Abertura
                    </Button>

                    <Button onClick={() => processImages("close")} disabled={!image1}>
                      Fechamento
                    </Button>

                    <Button onClick={() => processImages("contour")} disabled={!image1}>
                      Contorno
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Configurações</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Ajuste o tamanho do elemento estruturante para operações morfológicas.
                  </p>
                  <div>
                    <Label>
                      Tamanho do Elemento: {kernelSize}x{kernelSize}
                    </Label>
                    <Select
                      value={kernelSize.toString()}
                      onValueChange={(value) => setKernelSize(Number.parseInt(value))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Selecione o tamanho" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3x3</SelectItem>
                        <SelectItem value="5">5x5</SelectItem>
                        <SelectItem value="7">7x7</SelectItem>
                        <SelectItem value="9">9x9</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Canvas ocultos para processamento de imagem */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <canvas ref={resultCanvasRef} style={{ display: "none" }} />
    </div>
  )
}

export default ImageProcessor

