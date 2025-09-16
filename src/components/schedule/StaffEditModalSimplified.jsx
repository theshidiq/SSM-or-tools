/**
 * Phase 3: Simplified StaffEditModal Component
 * Removes complex state management layers in favor of WebSocket hook
 * Eliminates race conditions and optimistic update complexity
 */

import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import useWebSocketStaff from "../../hooks/useWebSocketStaff";

// ShadCN UI Components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from "lucide-react";

const StaffEditModalSimplified = ({
  showStaffEditModal,
  setShowStaffEditModal,
  isAddingNewStaff,
  setIsAddingNewStaff,
  selectedStaffForEdit,
  setSelectedStaffForEdit,
  editingStaffData,
  setEditingStaffData,
  currentMonthIndex,
}) => {
  // Phase 3: Single source of truth - WebSocket hook handles everything
  const {
    staffMembers,
    updateStaff,
    addStaff,
    deleteStaff,
    isConnected,
    connectionStatus,
    lastError
  } = useWebSocketStaff(currentMonthIndex);

  // Simple local state for form and operations
  const [operationInProgress, setOperationInProgress] = useState(false);
  const nameInputRef = useRef(null);

  // Auto-focus name input when modal opens
  useEffect(() => {
    if (showStaffEditModal) {
      setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
    }
  }, [showStaffEditModal]);

  // Provide default values for form data
  const safeEditingStaffData = editingStaffData || {
    name: "",
    position: "",
    status: "社員",
    startPeriod: null,
    endPeriod: null,
  };

  if (!showStaffEditModal) return null;

  // Phase 3: Simplified submit handler - WebSocket handles everything
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!safeEditingStaffData.name?.trim()) {
      toast.error("名前を入力してください");
      return;
    }

    if (!isConnected) {
      toast.error("サーバーに接続されていません。再接続をお待ちください。");
      return;
    }

    setOperationInProgress(true);

    try {
      if (isAddingNewStaff) {
        console.log('📤 Phase 3: Adding new staff via WebSocket:', safeEditingStaffData.name);
        await addStaff(safeEditingStaffData); // WebSocket handles everything

        // UI updates automatically via WebSocket
        toast.success(`${safeEditingStaffData.name}を追加しました`);

        // Reset form for next addition
        setEditingStaffData({
          name: "",
          position: "",
          status: "社員",
          startPeriod: null,
          endPeriod: null,
        });

        // Keep modal open and focus for next entry
        setTimeout(() => {
          if (nameInputRef.current) {
            nameInputRef.current.focus();
          }
        }, 100);

      } else if (selectedStaffForEdit) {
        console.log('📤 Phase 3: Updating staff via WebSocket:', selectedStaffForEdit.id);
        await updateStaff(selectedStaffForEdit.id, safeEditingStaffData);

        // UI updates automatically via WebSocket
        toast.success(`${safeEditingStaffData.name}を更新しました`);

        // Close modal after successful update
        setShowStaffEditModal(false);
      }
    } catch (error) {
      console.error('❌ Phase 3: Staff operation failed:', error);
      toast.error(`操作に失敗しました: ${error.message}`);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaffForEdit) return;
    if (!isConnected) {
      toast.error("サーバーに接続されていません。再接続をお待ちください。");
      return;
    }

    if (!window.confirm(`${selectedStaffForEdit.name}を削除しますか？この操作は取り消せません。`)) {
      return;
    }

    setOperationInProgress(true);

    try {
      console.log('📤 Phase 3: Deleting staff via WebSocket:', selectedStaffForEdit.id);
      await deleteStaff(selectedStaffForEdit.id);

      // UI updates automatically via WebSocket
      toast.success(`${selectedStaffForEdit.name}を削除しました`);

      // Close modal
      setShowStaffEditModal(false);
    } catch (error) {
      console.error('❌ Phase 3: Staff deletion failed:', error);
      toast.error(`削除に失敗しました: ${error.message}`);
    } finally {
      setOperationInProgress(false);
    }
  };

  const handleCancel = () => {
    setShowStaffEditModal(false);
    setIsAddingNewStaff(false);
    setSelectedStaffForEdit(null);
  };

  // Connection status indicator
  const ConnectionStatus = () => {
    if (connectionStatus === 'connected') {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <Wifi className="w-3 h-3 mr-1" />
          リアルタイム接続
        </Badge>
      );
    } else if (connectionStatus === 'connecting') {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          接続中...
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <WifiOff className="w-3 h-3 mr-1" />
          接続エラー
        </Badge>
      );
    }
  };

  return (
    <Dialog open={showStaffEditModal} onOpenChange={setShowStaffEditModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {isAddingNewStaff ? "新しいスタッフを追加" : "スタッフ情報を編集"}
            <ConnectionStatus />
          </DialogTitle>
          <DialogDescription>
            {isAddingNewStaff
              ? "新しいスタッフメンバーの情報を入力してください。"
              : "スタッフメンバーの情報を更新してください。"
            }
          </DialogDescription>
        </DialogHeader>

        {lastError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">{lastError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名前 *</Label>
            <Input
              id="name"
              ref={nameInputRef}
              value={safeEditingStaffData.name}
              onChange={(e) => setEditingStaffData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="スタッフの名前を入力"
              disabled={operationInProgress}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">役職</Label>
            <Input
              id="position"
              value={safeEditingStaffData.position || ""}
              onChange={(e) => setEditingStaffData(prev => ({ ...prev, position: e.target.value }))}
              placeholder="役職を入力（例：調理主任）"
              disabled={operationInProgress}
            />
          </div>

          <div className="space-y-2">
            <Label>雇用形態</Label>
            <RadioGroup
              value={safeEditingStaffData.status || "社員"}
              onValueChange={(value) => setEditingStaffData(prev => ({ ...prev, status: value }))}
              disabled={operationInProgress}
              className="flex flex-row space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="社員" id="employee" />
                <Label htmlFor="employee">社員</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="パート" id="part-time" />
                <Label htmlFor="part-time">パート</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-between gap-2 pt-4">
            <div className="flex gap-2">
              {!isAddingNewStaff && selectedStaffForEdit && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={operationInProgress || !isConnected}
                >
                  {operationInProgress ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : null}
                  削除
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={operationInProgress}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={operationInProgress || !isConnected}
              >
                {operationInProgress ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : null}
                {isAddingNewStaff ? "追加" : "更新"}
              </Button>
            </div>
          </div>
        </form>

        {/* Phase 3: Display current staff count from WebSocket */}
        <div className="text-xs text-gray-500 text-center pt-2">
          現在のスタッフ数: {staffMembers.length}名
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StaffEditModalSimplified;