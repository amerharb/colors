export type Language = 'en' | 'ar' | 'de' | 'sv' | 'he'

export type Color = {
    code: string,
    name: Record<Language, string>,
    // when true, only shown in development / beta builds, hidden in production
    beta?: boolean,
}
