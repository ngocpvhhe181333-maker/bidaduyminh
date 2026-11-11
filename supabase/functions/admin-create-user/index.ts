// Supabase Edge Function: Tạo tài khoản nhân viên / Admin mới
// Triển khai bằng: supabase functions deploy admin-create-user
// Lưu ý: KHÔNG bao giờ đưa SUPABASE_SERVICE_ROLE_KEY vào mã frontend React.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error('Thiếu cấu hình biến môi trường Supabase Edge Function.')
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: authError,
    } = await callerClient.auth.getUser()

    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Phiên đăng nhập không hợp lệ.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', caller.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: 'Chỉ Admin đang hoạt động mới có quyền tạo tài khoản.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.full_name ?? '').trim()
    const role = body.role === 'admin' ? 'admin' : 'cashier'

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Email không hợp lệ.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Mật khẩu phải có tối thiểu 6 ký tự.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (fullName.length < 2) {
      return new Response(JSON.stringify({ error: 'Họ tên phải có tối thiểu 2 ký tự.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { created_by_admin: true, role },
    })

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: newProfile } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', created.user.id)
      .single()

    return new Response(JSON.stringify({ profile: newProfile }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Lỗi máy chủ' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
