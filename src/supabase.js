import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ktlbfzswlwuqtfnwdyrd.supabase.co'
const supabaseKey = 'sb_publishable_nIL9ezsRCHfOaGJy_uwDJw_2Xzw0L6f'

export const supabase = createClient(supabaseUrl, supabaseKey)
