import React from "react";
import { BarChart3, FileText, TrendingUp } from "lucide-react";
import { getOrderedStaffMembers } from "../../utils/staffUtils";
import { calculateWorkloadPercentage } from "../../utils/statisticsUtils";

// ShadCN UI components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Separator } from "../ui/separator";

const StatisticsDashboard = ({ statistics, staffMembers, dateRange }) => {
  const orderedStaffMembers = getOrderedStaffMembers(staffMembers, dateRange);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 japanese-text">
            <BarChart3 size={24} />
            統計・分析 (Statistics & Analytics)
          </CardTitle>
          <CardDescription>スタッフ別勤務パターンと負荷分析</CardDescription>
        </CardHeader>
        <CardContent>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg japanese-text">
                <FileText size={20} />
                スタッフ別勤務パターン詳細
              </CardTitle>
              <CardDescription>各スタッフの勤務状況と負荷割合</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="japanese-text">
                        スタッフ (Staff)
                      </TableHead>
                      <TableHead className="text-center">
                        <Badge variant="outline">○ Normal</Badge>
                      </TableHead>
                      <TableHead className="text-center">
                        <Badge
                          variant="outline"
                          className="text-blue-600 border-blue-600"
                        >
                          △ Early
                        </Badge>
                      </TableHead>
                      <TableHead className="text-center">
                        <Badge
                          variant="outline"
                          className="text-destructive border-destructive"
                        >
                          × Off
                        </Badge>
                      </TableHead>
                      <TableHead className="text-center">
                        <Badge
                          variant="outline"
                          className="text-yellow-600 border-yellow-600"
                        >
                          ★ Holiday
                        </Badge>
                      </TableHead>
                      <TableHead className="text-center">
                        <Badge
                          variant="outline"
                          className="text-green-600 border-green-600"
                        >
                          Total
                        </Badge>
                      </TableHead>
                      <TableHead className="text-center">
                        <Badge
                          variant="outline"
                          className="text-purple-600 border-purple-600"
                        >
                          <TrendingUp size={12} className="mr-1" />
                          Workload
                        </Badge>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderedStaffMembers.map((staff) => {
                      const staffStats = statistics.staffStats[staff.id];
                      const workloadPercentage = calculateWorkloadPercentage(
                        staffStats,
                        dateRange.length,
                      );

                      // Calculate total: triangle=0.5, cross=1, stars=1
                      const total =
                        (staffStats?.early || 0) * 0.5 +
                        (staffStats?.off || 0) * 1 +
                        (staffStats?.holiday || 0) * 1;

                      return (
                        <TableRow key={staff.id}>
                          <TableCell className="font-medium japanese-text">
                            {staffStats?.name || staff.name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {staffStats?.normal || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className="text-blue-600"
                            >
                              {staffStats?.early || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className="text-destructive"
                            >
                              {staffStats?.off || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className="text-yellow-600"
                            >
                              {staffStats?.holiday || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className="text-green-600"
                            >
                              {total}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <Progress
                                value={workloadPercentage}
                                className="w-16 h-2"
                              />
                              <Badge
                                variant="outline"
                                className="text-purple-600 border-purple-600"
                              >
                                {workloadPercentage}%
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatisticsDashboard;
