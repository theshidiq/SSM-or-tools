/**
 * supabaseCapabilities.js
 *
 * Utility to check Supabase capabilities and determine
 * if automated database setup is supported.
 */

import { supabase } from "./supabase.js";

export class SupabaseCapabilities {
  static async checkRPCSupport() {
    try {
      // Test if exec RPC function is available
      const { error } = await supabase.rpc("exec", { sql: "SELECT 1;" });

      if (error) {
        // Check if it's a "function does not exist" error
        if (
          error.message.includes("function") &&
          error.message.includes("does not exist")
        ) {
          return {
            supported: false,
            reason: "RPC exec function not available",
            recommendation:
              "Use manual setup or enable RPC functions in Supabase",
          };
        }

        // Other errors might still mean RPC is supported but SQL failed
        return {
          supported: true,
          reason: "RPC available but test query failed",
          warning: error.message,
        };
      }

      return {
        supported: true,
        reason: "RPC exec function is available and working",
      };
    } catch (error) {
      return {
        supported: false,
        reason: "Unable to test RPC capabilities",
        error: error.message,
        recommendation: "Use manual setup",
      };
    }
  }

  static async checkDirectTableAccess() {
    try {
      // Try to access a non-existent table to test permissions
      const { error } = await supabase
        .from("test_permissions_check")
        .select("count")
        .limit(0);

      if (error) {
        // 42P01 is "relation does not exist" which is expected and fine
        if (error.code === "42P01") {
          return {
            supported: true,
            reason: "Table access permissions are available",
          };
        }

        // Other errors might indicate permission issues
        return {
          supported: false,
          reason: "Insufficient database permissions",
          error: error.message,
          recommendation: "Check Supabase RLS policies and authentication",
        };
      }

      return {
        supported: true,
        reason: "Full table access permissions available",
      };
    } catch (error) {
      return {
        supported: false,
        reason: "Cannot test table access permissions",
        error: error.message,
      };
    }
  }

  static async checkAllCapabilities() {
    const [rpcSupport, tableAccess] = await Promise.all([
      this.checkRPCSupport(),
      this.checkDirectTableAccess(),
    ]);

    const automatedSetupSupported =
      rpcSupport.supported && tableAccess.supported;

    return {
      rpcSupport,
      tableAccess,
      automatedSetupSupported,
      recommendedMode: automatedSetupSupported ? "automated" : "manual",
      summary: automatedSetupSupported
        ? "Automated database setup is fully supported"
        : "Manual database setup is recommended due to limitations",
    };
  }
}

export default SupabaseCapabilities;
