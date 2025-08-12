import { useRouter } from 'next/router'

interface MultilingualTextProps {
  en: string
  zh: string
  className?: string
}

export default function MultilingualText({ en, zh, className = '' }: MultilingualTextProps) {
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  
  return (
    <span className={className}>
      {currentLocale === 'zh' ? zh : en}
    </span>
  )
}
