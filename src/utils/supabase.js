import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file.",
  );
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Load specific schedule by ID
export const loadSpecificSchedule = async (scheduleId = '4eb3024d-7f8c-499f-8ce3-8efe584e0a8e') => {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();
    
    if (error) throw error;
    
    console.log('🎯 Loading specific schedule:', scheduleId);
    console.log('📊 Data structure:', {
      hasStaffMembers: !!data.schedule_data._staff_members,
      staffCount: data.schedule_data._staff_members?.length,
      staffNames: data.schedule_data._staff_members?.slice(0,3).map(s => s.name)
    });
    
    return data;
  } catch (error) {
    console.error('❌ Failed to load specific schedule:', error);
    return null;
  }
};

// Export default client for convenience
export default supabase;
