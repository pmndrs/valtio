import { useRouter } from 'next/router'

interface LanguageSwitcherProps {
  className?: string
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const router = useRouter()
  const currentLocale = router.locale || 'en'
  const locales = ['en', 'zh']

  const handleLanguageChange = (newLocale: string) => {
    const { pathname, asPath, query } = router
    router.push({ pathname, query }, asPath, { locale: newLocale })
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <div className="flex items-center space-x-2">
        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <select
          value={currentLocale}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="bg-transparent border-none text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded cursor-pointer"
        >
          {locales.map((locale) => (
            <option key={locale} value={locale}>
              {locale === 'en' ? 'English' : '中文'}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
