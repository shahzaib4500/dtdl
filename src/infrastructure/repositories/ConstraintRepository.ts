/**
 * Infrastructure: Constraint Repository
 * Data access layer for property constraints
 */

import { prisma } from "../database/prisma.js";

export interface PropertyConstraint {
  id: string;
  entityType: string;
  property: string;
  minValue?: number;
  maxValue?: number;
  readOnly: boolean;
  editable: boolean;
  allowedValues?: any[];
}

export interface IConstraintRepository {
  getConstraint(
    entityType: string,
    property: string
  ): Promise<PropertyConstraint | null>;
  getAllConstraints(): Promise<PropertyConstraint[]>;
  saveConstraint(constraint: Omit<PropertyConstraint, "id">): Promise<void>;
}

export class PrismaConstraintRepository implements IConstraintRepository {
  async getConstraint(
    entityType: string,
    property: string
  ): Promise<PropertyConstraint | null> {
    const constraint = await prisma.propertyConstraint.findUnique({
      where: {
        entityType_property: {
          entityType,
          property,
        },
      },
    });

    return constraint
      ? {
          id: constraint.id,
          entityType: constraint.entityType,
          property: constraint.property,
          minValue: constraint.minValue ?? undefined,
          maxValue: constraint.maxValue ?? undefined,
          readOnly: constraint.readOnly,
          editable: constraint.editable,
          allowedValues: constraint.allowedValues as any[] | undefined,
        }
      : null;
  }

  async getAllConstraints(): Promise<PropertyConstraint[]> {
    const constraints = await prisma.propertyConstraint.findMany();
    return constraints.map((c: Awaited<ReturnType<typeof prisma.propertyConstraint.findMany>>[0]) => ({
      id: c.id,
      entityType: c.entityType,
      property: c.property,
      minValue: c.minValue ?? undefined,
      maxValue: c.maxValue ?? undefined,
      readOnly: c.readOnly,
      editable: c.editable,
      allowedValues: c.allowedValues as any[] | undefined,
    }));
  }

  async saveConstraint(
    constraint: Omit<PropertyConstraint, "id">
  ): Promise<void> {
    await prisma.propertyConstraint.upsert({
      where: {
        entityType_property: {
          entityType: constraint.entityType,
          property: constraint.property,
        },
      },
      create: {
        entityType: constraint.entityType,
        property: constraint.property,
        minValue: constraint.minValue,
        maxValue: constraint.maxValue,
        readOnly: constraint.readOnly,
        editable: constraint.editable,
        allowedValues: constraint.allowedValues as any,
      },
      update: {
        minValue: constraint.minValue,
        maxValue: constraint.maxValue,
        readOnly: constraint.readOnly,
        editable: constraint.editable,
        allowedValues: constraint.allowedValues as any,
      },
    });
  }
}

