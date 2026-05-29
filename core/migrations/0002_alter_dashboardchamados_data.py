from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='dashboardchamados',
            name='data',
            field=models.DateField(null=True, blank=True),
        ),
    ]
