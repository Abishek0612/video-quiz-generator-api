import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserRole } from '../common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async onModuleInit() {
    await this.createDefaultAdmin();
  }

  private async createDefaultAdmin() {
    const adminExists = await this.userModel
      .findOne({ role: UserRole.ADMIN })
      .exec();

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await this.userModel.create({
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        isActive: true,
      });
      console.log('✅ Default admin user created');
      console.log('📧 Email: admin@example.com');
      console.log('🔑 Password: admin123');
    }
  }
}
