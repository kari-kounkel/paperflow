import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://keegxjuckohhtxllqxak.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZWd4anVja29oaHR4bGxxeGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NTA2MTgsImV4cCI6MjA4NjIyNjYxOH0.O1a1PBx1sscVVEX-xlvsPoFaUwXw_gjiYI-ehWBJAz0'

export const supabase = createClient(supabaseUrl, supabaseKey)
