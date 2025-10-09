"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Entity } from "@/types";
import { DiffIcon, OptionIcon, Calendar, User, Phone } from "lucide-react";

interface DuplicateComparisonProps {
  entities: Entity[];
  searchTerm?: string;
}

const DuplicateComparison: React.FC<DuplicateComparisonProps> = ({
  entities,
  searchTerm,
}) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const conflictStats = {
    nameConflicts: 0,
    phoneConflicts: 0,
    total: 0,
  };

  if (entities.length > 1) {
    const names = entities.map((e) => e.name);
    if (new Set(names).size > 1) conflictStats.nameConflicts++;

    const allPhones = entities.map((e) => e.phone ? [e.phone] : []);
    if (
      allPhones.some((phones, idx) =>
        allPhones.some(
          (otherPhones, otherIdx) => idx !== otherIdx && phones.some((phone) => !otherPhones.includes(phone)),
        ),
      )
    ) {
      conflictStats.phoneConflicts++;
    }

    conflictStats.total = Object.values(conflictStats).reduce((a, b) => a + b, 0) - conflictStats.total;
  }

  return (
    <div className="space-y-8 w-full overflow-x-auto">
      <Card className={cn("border shadow-none rounded-md")}> 
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-semibold text-foreground">Entity Comparison</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-sm px-3 py-1.5">
                {entities.length} entity{entities.length !== 1 ? "ies" : ""}
              </Badge>
              {conflictStats.total > 0 && (
                <Badge variant="destructive" className="gap-1 px-3 py-1.5">
                  {conflictStats.total} conflict{conflictStats.total !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">Field</th>
                  {entities.map((e) => (
                    <th key={e.id} className="px-3 py-2 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.name}</span>
                        <Badge className={e.entityType === 'organization' ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-green-100 text-green-800 border-green-200"}>#{e.id}</Badge>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium flex items-center gap-2"><DiffIcon className="h-4 w-4 text-primary" /> Entity Name</td>
                  {entities.map((e, i) => (
                    <td key={`name-${i}`} className="px-3 py-2">{e.name || ""}</td>
                  ))}
                </tr>
                <tr className="hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> Phone</td>
                  {entities.map((e, i) => (
                    <td key={`phone-${i}`} className="px-3 py-2">{e.phone || "N/A"}</td>
                  ))}
                </tr>
                <tr className="hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium flex items-center gap-2"><OptionIcon className="h-4 w-4 text-primary" /> Entity Type</td>
                  {entities.map((e, i) => (
                    <td key={`type-${i}`} className="px-3 py-2">{e.entityType === 'organization' ? 'Organization' : 'Person'}</td>
                  ))}
                </tr>
                <tr className="hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Created Date</td>
                  {entities.map((e, i) => (
                    <td key={`date-${i}`} className="px-3 py-2">{formatDate(e.createdAt) || ""}</td>
                  ))}
                </tr>
                <tr className="hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Confidence</td>
                  {entities.map((e, i) => (
                    <td key={`confidence-${i}`} className="px-3 py-2">{(e.confidence * 100).toFixed(1)}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
                </div>
  );
};

export default DuplicateComparison;